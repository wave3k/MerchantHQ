import * as SecureStore from "./secureStore";

const CURRENT_SHOP_KEY = "merchanthq.current-shop";

let currentShopId: string | null = null;
let initialized = false;

export async function initShopContext(): Promise<void> {
  if (initialized) return;
  try {
    currentShopId = await SecureStore.getItemAsync(CURRENT_SHOP_KEY);
  } catch {}
  initialized = true;
}

export function getCurrentShopId(): string | null {
  return currentShopId;
}

export function getCurrentShopIdOrThrow(): string {
  if (!currentShopId) {
    throw new Error("Aucune boutique sélectionnée.");
  }
  return currentShopId;
}

export async function setCurrentShopId(shopId: string | null): Promise<void> {
  currentShopId = shopId;
  if (shopId) {
    try {
      await SecureStore.setItemAsync(CURRENT_SHOP_KEY, shopId);
    } catch {}
  } else {
    try {
      await SecureStore.deleteItemAsync(CURRENT_SHOP_KEY);
    } catch {}
  }
}

export async function resetShopContext(): Promise<void> {
  await setCurrentShopId(null);
}