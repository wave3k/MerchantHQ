export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 0;

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Le navigateur peut refuser le stockage privé ; l’application reste utilisable.
  }
}

export function getItem(key: string): string | null {
  return read(key);
}

export async function getItemAsync(key: string): Promise<string | null> {
  return read(key);
}

export async function setItemAsync(
  key: string,
  value: string,
): Promise<void> {
  write(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Rien à nettoyer si le stockage est indisponible.
  }
}
