// mobile/services/api.ts
/**
 * Axios instance с автоматическим:
 * 1. Прикреплением access token к каждому запросу
 * 2. Обновлением access token если получили 401
 * 3. Логаутом если refresh token тоже истёк
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
  clearAll,
} from './storage';

// ─── Базовый URL ─────────────────────────────────────────────────
// Для разработки: IP твоего компьютера в локальной сети
// Узнать: в терминале ipconfig → IPv4 адрес
// Expo на телефоне не может обратиться к localhost напрямую
const BASE_URL = __DEV__
  ? 'http://10.202.11.16:8080'   // ← замени на свой IP
  : 'https://api.orleu.app';       // production (пока не нужно)

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — прикрепляем access token ──────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Force-logout callback (set by authStore to avoid circular dep) ─
let _forceLogout: (() => void) | null = null;
export function registerForceLogout(fn: () => void) { _forceLogout = fn; }

// ─── Response interceptor — обновляем токен при 401 ──────────────
let isRefreshing = false;
const MAX_REFRESH_QUEUE = 50;
// очередь запросов ожидающих обновления токена
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  // Успешный ответ — просто возвращаем
  (response) => response,

  // Ошибка — проверяем 401
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Если не 401 или уже ретраили — пробрасываем ошибку дальше
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Если уже идёт обновление токена — ставим запрос в очередь
    if (isRefreshing) {
      if (failedQueue.length >= MAX_REFRESH_QUEUE) {
        return Promise.reject(new Error('Too many queued requests during token refresh'));
      }
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        // No saved refresh token — definitely signed out
        processQueue(new Error('No refresh token'), null);
        await clearAll();
        _forceLogout?.();
        return Promise.reject(error);
      }

      // Запрос на обновление — без interceptors чтобы не зациклиться
      const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newAccessToken: string  = data.access_token;
      const newRefreshToken: string | undefined = data.refresh_token;

      // Persist BOTH tokens — rotation invalidates the old refresh on the server
      await saveAccessToken(newAccessToken);
      if (newRefreshToken) {
        await saveRefreshToken(newRefreshToken);
      }

      processQueue(null, newAccessToken);

      // Повторяем оригинальный запрос с новым токеном
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);

    } catch (refreshError: unknown) {
      // Distinguish a true auth failure (refresh token rejected by server)
      // from a transient network error (no response at all). The former means
      // the session is dead and we must log out. The latter is recoverable —
      // do NOT clear tokens, just reject so the caller can retry later.
      const ax = refreshError as { response?: { status?: number }; code?: string; message?: string };
      const isNetworkError =
        !ax.response ||
        ax.code === 'ERR_NETWORK' ||
        ax.code === 'ECONNABORTED' ||
        ax.message === 'Network Error';

      if (isNetworkError) {
        // Keep tokens — user may regain connectivity and resume the session
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      }

      // Genuine auth failure (401/403 from /refresh) — refresh token is dead
      processQueue(refreshError, null);
      await clearAll();
      _forceLogout?.();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Типизированные методы ────────────────────────────────────────
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    name: string;
    avatar_theme_id: number;
    experience_level: string;
    primary_goal: string;
  }) => api.post('/api/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),

  logout: (refreshToken: string) =>
    api.post('/api/auth/logout', { refresh_token: refreshToken }),

  me: () => api.get('/api/auth/me'),

  updateMe: (data: {
    name?: string;
    primary_goal?: 'strength' | 'hypertrophy' | 'endurance';
    experience_level?: 'beginner' | 'intermediate' | 'advanced';
    avatar_theme_id?: number;
  }) => api.patch('/api/auth/me', data),

  changePassword: (data: { old_password: string; new_password: string }) =>
    api.post('/api/auth/change-password', data),

  deleteMe: (data: { password: string }) =>
    api.delete('/api/auth/me', { data }),

  exportData: () => api.get('/api/auth/export'),
};