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
  clearAll,
} from './storage';

// ─── Базовый URL ─────────────────────────────────────────────────
// Для разработки: IP твоего компьютера в локальной сети
// Узнать: в терминале ipconfig → IPv4 адрес
// Expo на телефоне не может обратиться к localhost напрямую
const BASE_URL = __DEV__
  ? 'http://192.168.0.102:8080'   // ← замени на свой IP
  : 'https://api.orleu.app';       // production (пока не нужно)

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
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

// ─── Response interceptor — обновляем токен при 401 ──────────────
let isRefreshing = false;
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
      if (!refreshToken) throw new Error('No refresh token');

      // Запрос на обновление — без interceptors чтобы не зациклиться
      const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newAccessToken: string = data.access_token;
      await saveAccessToken(newAccessToken);

      processQueue(null, newAccessToken);

      // Повторяем оригинальный запрос с новым токеном
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);

    } catch (refreshError) {
      // Refresh token тоже протух — разлогиниваем
      processQueue(refreshError, null);
      await clearAll();
      // Zustand store сам среагирует через storage listener
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
};