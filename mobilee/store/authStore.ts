// mobile/store/authStore.ts
/**
 * Zustand store для аутентификации.
 * Хранит: текущего юзера, статус загрузки, методы login/logout/register.
 *
 * Используется в компонентах так:
 *   const { user, login } = useAuthStore();
 */
import { create } from 'zustand';
import {
  saveAccessToken,
  saveRefreshToken,
  saveUser,
  getAccessToken,
  getSavedUser,
  getRefreshToken,
  clearAll,
} from '../services/storage';
import { authApi } from '../services/api';

// ─── Типы ────────────────────────────────────────────────────────
export interface User {
  id:               string;
  email:            string;
  name:             string;
  avatar_theme_id:  number;
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  primary_goal:     'strength' | 'hypertrophy' | 'endurance';
  onboarding_done:  boolean;
}

interface AuthState {
  user:        User | null;
  isLoggedIn:  boolean;
  isLoading:   boolean;   // начальная проверка токена
  error:       string | null;

  // Методы
  init:     () => Promise<void>;
  login:    (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout:   () => Promise<void>;
  clearError: () => void;
  setUser:  (user: User) => void;
}

export interface RegisterData {
  email:            string;
  password:         string;
  name:             string;
  avatar_theme_id:  number;
  experience_level: string;
  primary_goal:     string;
}

// ─── Store ───────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user:       null,
  isLoggedIn: false,
  isLoading:  true,  // true при старте — ждём проверки токена
  error:      null,

  // ── init — вызывается при старте приложения ──────────────────
  // Читает сохранённые данные из SecureStore
  // Если есть токен и юзер → считаем залогиненным
  init: async () => {
    try {
      const [token, user] = await Promise.all([
        getAccessToken(),
        getSavedUser<User>(),
      ]);

      if (token && user) {
        set({ user, isLoggedIn: true });
      }
    } catch (e) {
      // если что-то сломалось — просто не логиним
      console.warn('Auth init failed:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── login ────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ error: null });
    try {
      const { data } = await authApi.login({ email, password });
      await Promise.all([
        saveAccessToken(data.access_token),
        saveRefreshToken(data.refresh_token),
        saveUser(data.user),
      ]);
      set({ user: data.user, isLoggedIn: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Login failed. Check your credentials.';
      set({ error: msg });
      throw err; // пробрасываем чтобы компонент мог среагировать
    }
  },

  // ── register ─────────────────────────────────────────────────
  register: async (data: RegisterData) => {
    set({ error: null });
    try {
      const { data: res } = await authApi.register(data);
      await Promise.all([
        saveAccessToken(res.access_token),
        saveRefreshToken(res.refresh_token),
        saveUser(res.user),
      ]);
      set({ user: res.user, isLoggedIn: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Registration failed. Try again.';
      set({ error: msg });
      throw err;
    }
  },

  // ── logout ───────────────────────────────────────────────────
  logout: async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        // Говорим серверу удалить сессию (тихо — если упадёт не критично)
        await authApi.logout(refreshToken).catch(() => {});
      }
    } finally {
      await clearAll();
      set({ user: null, isLoggedIn: false });
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user: User) => {
    set({ user });
    saveUser(user);
  },
}));