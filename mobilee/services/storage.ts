/**
 * Обёртка над expo-secure-store.
 * Хранит токены в зашифрованном хранилище устройства.
 * Никогда не используй AsyncStorage для токенов — он не зашифрован.
 */
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN:        'orleu_access_token',
  REFRESH_TOKEN:       'orleu_refresh_token',
  USER:                'orleu_user',
  DISMISSED_EXPIRIES:  'orleu_dismissed_mission_expiries',
  SEEN_PRS:            'orleu_seen_prs',
  LAST_SEEN_TREND:     'orleu_last_seen_trend',
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

// ─── Dismissed mission-expiry IDs ────────────────────────────────
// Tracks expired-mission IDs the user has already acknowledged so the
// "Mission expired" banner is shown once and then disappears.
export async function getDismissedExpiries(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEYS.DISMISSED_EXPIRIES);
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}
export async function addDismissedExpiry(id: string) {
  const current = await getDismissedExpiries();
  if (current.includes(id)) return;
  // Cap at 50 most recent to avoid unbounded growth.
  const next = [id, ...current].slice(0, 50);
  await SecureStore.setItemAsync(KEYS.DISMISSED_EXPIRIES, JSON.stringify(next));
}

// ─── Seen PR fingerprints ────────────────────────────────────────
// Fingerprint format: `${exercise_id}:${achieved_at}`. A new PR with the
// same exercise but a fresher timestamp produces a new fingerprint, so
// the "NEW" badge fires on any record-breaking lift, not just first-ever.
export async function getSeenPrs(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEYS.SEEN_PRS);
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}
export async function markPrsSeen(fingerprints: string[]) {
  if (fingerprints.length === 0) return;
  const current = await getSeenPrs();
  const merged = Array.from(new Set([...fingerprints, ...current])).slice(0, 200);
  await SecureStore.setItemAsync(KEYS.SEEN_PRS, JSON.stringify(merged));
}

// ─── Last-seen ML trend ──────────────────────────────────────────
// Lets the Missions screen show the "coach update" insight modal once per
// trend change, instead of on every refresh.
export async function getLastSeenTrend(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.LAST_SEEN_TREND);
}
export async function setLastSeenTrend(trend: string) {
  await SecureStore.setItemAsync(KEYS.LAST_SEEN_TREND, trend);
}

// ─── Clear all (logout) ──────────────────────────────────────────
export async function clearAll() {
  await Promise.all([
    removeAccessToken(),
    removeRefreshToken(),
    removeUser(),
    SecureStore.deleteItemAsync(KEYS.DISMISSED_EXPIRIES),
    SecureStore.deleteItemAsync(KEYS.SEEN_PRS),
    SecureStore.deleteItemAsync(KEYS.LAST_SEEN_TREND),
  ]);
}