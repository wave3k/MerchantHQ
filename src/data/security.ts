import * as Crypto from "expo-crypto";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

const LEGACY_ITERATIONS = 80_000;
const ITERATIONS = 3_000;
const KEY_LENGTH = 32;
const HASH_PREFIX = "pbkdf2-v2";

export async function createPasswordHash(
  password: string,
): Promise<{ hash: string; salt: string }> {
  if (!password) return { hash: "", salt: "" };
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const hashBytes = await pbkdf2Async(
    sha256,
    utf8ToBytes(password),
    saltBytes,
    {
      c: ITERATIONS,
      dkLen: KEY_LENGTH,
      asyncTick: 8,
    },
  );
  return {
    hash: `${HASH_PREFIX}$${ITERATIONS}$${bytesToHex(hashBytes)}`,
    salt: bytesToHex(saltBytes),
  };
}

function safeEqual(candidate: string, expected: string): boolean {
  if (candidate.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function saltFromHex(saltHex: string): Uint8Array {
  return Uint8Array.from(
    saltHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHash: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!expectedHash) {
    return { valid: password.length === 0, needsUpgrade: false };
  }

  const parts = expectedHash.split("$");
  if (parts[0] === HASH_PREFIX && parts.length === 3) {
    const iterations = Number.parseInt(parts[1] ?? "", 10);
    const expected = parts[2] ?? "";
    if (!Number.isFinite(iterations) || iterations < 1 || !expected) {
      return { valid: false, needsUpgrade: false };
    }
    const candidate = bytesToHex(
      await pbkdf2Async(sha256, utf8ToBytes(password), saltFromHex(saltHex), {
        c: iterations,
        dkLen: KEY_LENGTH,
        asyncTick: 8,
      }),
    );
    return { valid: safeEqual(candidate, expected), needsUpgrade: false };
  }

  // Compatibilité avec les comptes créés par la première version du MVP.
  const candidate = bytesToHex(
    await pbkdf2Async(sha256, utf8ToBytes(password), saltFromHex(saltHex), {
      c: LEGACY_ITERATIONS,
      dkLen: KEY_LENGTH,
      asyncTick: 8,
    }),
  );
  const valid = safeEqual(candidate, expectedHash);
  return { valid, needsUpgrade: valid };
}
