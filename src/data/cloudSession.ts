import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import * as SecureStore from "./secureStore";

const ACCOUNT_ID_KEY = "merchanthq.account-id";
const USERNAME_KEY = "merchanthq.username";
const SHOP_NAME_KEY = "merchanthq.shop-name";
const TOKEN_KEY = "merchanthq.token";
const DEVICE_ID_KEY = "merchanthq.device-id";
const WORKER_URL_KEY = "merchanthq.worker-url";

const DEFAULT_WORKER_URL =
  (process.env.EXPO_PUBLIC_CLOUDFLARE_WORKER_URL as string | undefined) ?? "";

function isWeb(): boolean {
  return Platform.OS === "web";
}

async function webGet(key: string): Promise<string | null> {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}
async function webSet(key: string, value: string): Promise<void> {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }
}
async function webDelete(key: string): Promise<void> {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (isWeb()) {
    const v = await webGet(key);
    if (v !== null) return v;
  }
  try {
    return (await SecureStore.getItemAsync(key)) ?? null;
  } catch {
    return isWeb() ? webGet(key) : null;
  }
}
async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb()) {
    await webSet(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}
async function secureDelete(key: string): Promise<void> {
  if (isWeb()) {
    await webDelete(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

export interface CloudSession {
  accountId: string;
  username: string;
  shopName: string;
  token?: string;
}

export async function getSession(): Promise<CloudSession | null> {
  const accountId = await secureGet(ACCOUNT_ID_KEY);
  if (!accountId) return null;
  const username = (await secureGet(USERNAME_KEY)) ?? "";
  const shopName = (await secureGet(SHOP_NAME_KEY)) ?? "Ma boutique";
  const token = (await secureGet(TOKEN_KEY)) ?? undefined;
  return { accountId, username, shopName, token };
}

export async function saveSession(session: CloudSession): Promise<void> {
  await secureSet(ACCOUNT_ID_KEY, session.accountId);
  await secureSet(USERNAME_KEY, session.username);
  await secureSet(SHOP_NAME_KEY, session.shopName);
  if (session.token) await secureSet(TOKEN_KEY, session.token);
}

export async function clearSession(): Promise<void> {
  await secureDelete(ACCOUNT_ID_KEY);
  await secureDelete(USERNAME_KEY);
  await secureDelete(SHOP_NAME_KEY);
  await secureDelete(TOKEN_KEY);
}

export async function getDeviceId(): Promise<string> {
  const existing = await secureGet(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await secureSet(DEVICE_ID_KEY, created);
  return created;
}

export async function getWorkerUrl(): Promise<string | null> {
  const stored = await secureGet(WORKER_URL_KEY);
  if (stored) return stored;
  return DEFAULT_WORKER_URL || null;
}

export async function saveWorkerUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error();
      }
    } catch {
      throw new Error("L’URL du Worker doit être une URL https:// valide.");
    }
    await secureSet(WORKER_URL_KEY, trimmed);
  } else {
    await secureDelete(WORKER_URL_KEY);
  }
}