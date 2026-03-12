// mobile/services/storage.ts
/**
 * Обёртка над expo-secure-store.
 * Хранит токены в зашифрованном хранилище устройства.
 * Никогда не используй AsyncStorage для токенов — он не зашифрован.
 */
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN:  'orleu_access_token',
  REFRESH_TOKEN: 'orleu_refresh_token',
  USER:          'orleu_user',
} as const;

// ─── Access Token ────────────────────────────────────────────────
export async function saveAccessToken(token: string) {
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
}
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}
export async function removeAccessToken() {
  await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
}

// ─── Refresh Token ───────────────────────────────────────────────
export async function saveRefreshToken(token: string) {
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
}
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
}
export async function removeRefreshToken() {
  await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
}

// ─── User data ───────────────────────────────────────────────────
export async function saveUser(user: object) {
  await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
}
export async function getSavedUser<T>(): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(KEYS.USER);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
export async function removeUser() {
  await SecureStore.deleteItemAsync(KEYS.USER);
}

// ─── Clear all (logout) ──────────────────────────────────────────
export async function clearAll() {
  await Promise.all([
    removeAccessToken(),
    removeRefreshToken(),
    removeUser(),
  ]);
}