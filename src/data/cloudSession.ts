import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import * as SecureStore from "./secureStore";

const ACCOUNT_ID_KEY = "merchanthq.account-id";
const EMAIL_KEY = "merchanthq.email";
const EMAIL_VERIFIED_KEY = "merchanthq.email-verified";
const SHOP_NAME_KEY = "merchanthq.shop-name";
const SUBSCRIPTION_TYPE_KEY = "merchanthq.subscription-type";
const SUBSCRIPTION_EXPIRES_KEY = "merchanthq.subscription-expires";
const SUBSCRIPTION_PERMS_KEY = "merchanthq.subscription-perms";
const SUBSCRIPTION_DEVICES_KEY = "merchanthq.subscription-devices";
const SUBSCRIPTION_DEVICES_LIMIT_KEY = "merchanthq.subscription-devices-limit";
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

export interface PlanPermissions {
  tablets: number;
  cashiers: number;
  backup: string;
  reports: string;
  export_excel: boolean;
  tickets: boolean;
  support: string;
}

export interface CloudSession {
  accountId: string;
  email: string;
  emailVerified: boolean;
  shopName: string;
  subscriptionType?: string;
  subscriptionExpiresAt?: string;
  subscriptionPermissions?: PlanPermissions;
  subscriptionDevices?: number;
  subscriptionDevicesLimit?: number;
  token?: string;
}

export async function getSession(): Promise<CloudSession | null> {
  const accountId = await secureGet(ACCOUNT_ID_KEY);
  if (!accountId) return null;
  const [
    email,
    emailVerifiedRaw,
    shopName,
    subscriptionType,
    subscriptionExpiresAt,
    permsRaw,
    token,
    devicesRaw,
    devicesLimitRaw,
  ] = await Promise.all([
    secureGet(EMAIL_KEY),
    secureGet(EMAIL_VERIFIED_KEY),
    secureGet(SHOP_NAME_KEY),
    secureGet(SUBSCRIPTION_TYPE_KEY),
    secureGet(SUBSCRIPTION_EXPIRES_KEY),
    secureGet(SUBSCRIPTION_PERMS_KEY),
    secureGet(TOKEN_KEY),
    secureGet(SUBSCRIPTION_DEVICES_KEY),
    secureGet(SUBSCRIPTION_DEVICES_LIMIT_KEY),
  ]);
  let subscriptionPermissions: PlanPermissions | undefined;
  if (permsRaw) {
    try {
      subscriptionPermissions = JSON.parse(permsRaw) as PlanPermissions;
    } catch {
      subscriptionPermissions = undefined;
    }
  }
  return {
    accountId,
    email: email ?? "",
    emailVerified: emailVerifiedRaw === "1",
    shopName: shopName ?? "Ma boutique",
    subscriptionType: subscriptionType ?? undefined,
    subscriptionExpiresAt: subscriptionExpiresAt ?? undefined,
    subscriptionPermissions,
    subscriptionDevices: devicesRaw ? Number(devicesRaw) : undefined,
    subscriptionDevicesLimit: devicesLimitRaw ? Number(devicesLimitRaw) : undefined,
    token: token ?? undefined,
  };
}

export async function saveSession(session: CloudSession): Promise<void> {
  await secureSet(ACCOUNT_ID_KEY, session.accountId);
  await secureSet(EMAIL_KEY, session.email);
  await secureSet(EMAIL_VERIFIED_KEY, session.emailVerified ? "1" : "0");
  await secureSet(SHOP_NAME_KEY, session.shopName);
  if (session.subscriptionType) await secureSet(SUBSCRIPTION_TYPE_KEY, session.subscriptionType);
  if (session.subscriptionExpiresAt) await secureSet(SUBSCRIPTION_EXPIRES_KEY, session.subscriptionExpiresAt);
  if (session.subscriptionPermissions) await secureSet(SUBSCRIPTION_PERMS_KEY, JSON.stringify(session.subscriptionPermissions));
  if (session.subscriptionDevices != null) await secureSet(SUBSCRIPTION_DEVICES_KEY, String(session.subscriptionDevices));
  if (session.subscriptionDevicesLimit != null) await secureSet(SUBSCRIPTION_DEVICES_LIMIT_KEY, String(session.subscriptionDevicesLimit));
  if (session.token) await secureSet(TOKEN_KEY, session.token);
}

export async function clearSession(): Promise<void> {
  await secureDelete(ACCOUNT_ID_KEY);
  await secureDelete(EMAIL_KEY);
  await secureDelete(EMAIL_VERIFIED_KEY);
  await secureDelete(SHOP_NAME_KEY);
  await secureDelete(SUBSCRIPTION_TYPE_KEY);
  await secureDelete(SUBSCRIPTION_EXPIRES_KEY);
  await secureDelete(SUBSCRIPTION_PERMS_KEY);
  await secureDelete(SUBSCRIPTION_DEVICES_KEY);
  await secureDelete(SUBSCRIPTION_DEVICES_LIMIT_KEY);
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