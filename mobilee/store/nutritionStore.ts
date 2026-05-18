import { create } from 'zustand';
import { api } from '../services/api';
import {
  saveNutritionLogPending,
  getPendingNutritionLogs,
  markNutritionLogSynced,
  deleteNutritionLogPending,
} from '../services/database';
import { useAuthStore } from './authStore';

// ─── Types ────────────────────────────────────────────────────────
export interface FoodItem {
  id:               string;
  name:             string;
  brand:            string | null;
  calories_per_100g: number;
  protein_per_100g:  number;
  carbs_per_100g:    number;
  fat_per_100g:      number;
  is_custom:         boolean;
}

export interface RecentFoodItem {
  food_item_id:      string;
  name:              string;
  brand:             string | null;
  calories_per_100g: number;
  protein_per_100g:  number;
  carbs_per_100g:    number;
  fat_per_100g:      number;
  last_used_date:    string;
  typical_quantity_g: number;
}

export interface NutritionLogEntry {
  id:         string;
  food_item:  FoodItem;
  quantity_g: number;
  meal_type:  MealType;
  date:       string;
  calories:   number;
  protein_g:  number;
  carbs_g:    number;
  fat_g:      number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface MealSummary {
  calories: number;
  entries:  NutritionLogEntry[];
}

export interface NutritionDayResponse {
  date:      string;
  calories:  number;
  protein_g: number;
  carbs_g:   number;
  fat_g:     number;
  meals: {
    breakfast: MealSummary;
    lunch:     MealSummary;
    dinner:    MealSummary;
    snacks:    MealSummary;
  };
}

export interface NutritionGoals {
  calories:  number;
  protein_g: number;
  carbs_g:   number;
  fat_g:     number;
}

interface NutritionState {
  todayData:           NutritionDayResponse | null;
  goals:               NutritionGoals | null;
  selectedDate:        string;
  isLoading:           boolean;
  error:               string | null;
  recentFoods:         RecentFoodItem[];
  recentFoodsLoadedAt: number | null;

  loadDay:          (date: string) => Promise<void>;
  logFood:          (date: string, mealType: MealType, foodItemId: string, quantityG: number) => Promise<void>;
  removeLog:        (logId: string) => Promise<void>;
  loadGoals:        () => Promise<void>;
  updateGoals:      (goals: NutritionGoals) => Promise<void>;
  setDate:          (date: string) => void;
  syncPending:      () => Promise<void>;
  loadRecentFoods:  () => Promise<void>;
}

/** Returns today as YYYY-MM-DD in **local** time (not UTC). */
export function localDateISO(d: Date = new Date()): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RECENT_CACHE_MS = 5 * 60 * 1000; // 5 minutes

// ─── Store ───────────────────────────────────────────────────────
export const useNutritionStore = create<NutritionState>((set, get) => ({
  todayData:           null,
  goals:               null,
  selectedDate:        localDateISO(),
  isLoading:           false,
  error:               null,
  recentFoods:         [],
  recentFoodsLoadedAt: null,

  loadDay: async (date) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<NutritionDayResponse>('/api/nutrition/daily', { params: { date } });
      set({ todayData: data, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err?.response?.data?.detail ?? 'Failed to load nutrition data' });
    }
  },

  logFood: async (date, mealType, foodItemId, quantityG) => {
    try {
      await api.post('/api/nutrition/log', {
        food_item_id: foodItemId,
        quantity_g:   quantityG,
        meal_type:    mealType,
        date,
      });
      await get().loadDay(date);
    } catch (err: unknown) {
      // Only save offline for network errors — server validation errors should surface
      const isOffline =
        err instanceof Error &&
        ('code' in err || err.message === 'Network Error' || err.message.includes('timeout'));
      if (!isOffline && (err as Record<string, unknown>)?.response) {
        set({ error: ((err as Record<string, unknown>).response as Record<string, unknown>)?.data
          ? String(((err as Record<string, Record<string, unknown>>).response.data as Record<string, unknown>)?.detail ?? 'Failed to log food')
          : 'Failed to log food' });
        return;
      }
      // Offline: save to SQLite for later sync
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return; // not signed in — drop offline save
      const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await saveNutritionLogPending({
        id:           pendingId,
        user_id:      userId,
        food_item_id: foodItemId,
        quantity_g:   quantityG,
        meal_type:    mealType,
        date,
      }).catch((e) => console.warn('[nutritionStore] Failed to save pending log:', e));
    }
  },

  removeLog: async (logId) => {
    try {
      await api.delete(`/api/nutrition/log/${logId}`);
      const { selectedDate } = get();
      await get().loadDay(selectedDate);
    } catch (err: any) {
      set({ error: err?.response?.data?.detail ?? 'Failed to remove entry' });
    }
  },

  loadGoals: async () => {
    try {
      const { data } = await api.get<NutritionGoals>('/api/nutrition/goals');
      set({ goals: data });
    } catch (err: unknown) {
      console.warn('[nutritionStore] loadGoals failed:', err);
      set({ error: 'Failed to load nutrition goals' });
    }
  },

  updateGoals: async (goals) => {
    try {
      const { data } = await api.patch<NutritionGoals>('/api/nutrition/goals', goals);
      set({ goals: data });
    } catch (err: any) {
      set({ error: err?.response?.data?.detail ?? 'Failed to update goals' });
      throw err;
    }
  },

  setDate: (date) => {
    set({ selectedDate: date, todayData: null });
    get().loadDay(date);
  },

  syncPending: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    try {
      const pending = await getPendingNutritionLogs(userId);
      for (const log of pending) {
        try {
          await api.post('/api/nutrition/log', {
            food_item_id: log.food_item_id,
            quantity_g:   log.quantity_g,
            meal_type:    log.meal_type,
            date:         log.date,
          });
          // Retry marking as synced — failure causes duplicates on next sync
          let marked = false;
          for (let attempt = 0; attempt < 3 && !marked; attempt++) {
            try {
              await markNutritionLogSynced(log.id);
              marked = true;
            } catch { /* retry */ }
          }
          if (!marked) {
            console.warn(`[nutritionStore] Failed to mark log ${log.id} as synced after 3 attempts`);
          }
        } catch (syncErr: any) {
          const status = syncErr?.response?.status;
          const detail = syncErr?.response?.data?.detail;
          // 404 = food_item_id deleted on server; 422 = bad data — these can never succeed.
          // Delete locally so they don't block forever.
          if (status === 404 || status === 422) {
            console.warn(
              `[nutritionStore] Deleting unsyncable log ${log.id} (status=${status}): ${JSON.stringify(detail)}`,
            );
            await deleteNutritionLogPending(log.id).catch(() => {});
          } else {
            const reason = detail
              ? `status=${status}, detail=${JSON.stringify(detail)}`
              : (syncErr?.message ?? String(syncErr));
            console.warn(`[nutritionStore] failed to sync nutrition log ${log.id}: ${reason}`);
          }
        }
      }
      if (pending.length > 0) {
        const { selectedDate } = get();
        await get().loadDay(selectedDate);
      }
    } catch (err) {
      console.warn('[nutritionStore] syncPending failed:', err);
    }
  },

  loadRecentFoods: async () => {
    const { recentFoodsLoadedAt } = get();
    if (recentFoodsLoadedAt && Date.now() - recentFoodsLoadedAt < RECENT_CACHE_MS) return;
    try {
      const { data } = await api.get<RecentFoodItem[]>('/api/nutrition/recent', { params: { limit: 8 } });
      set({ recentFoods: data, recentFoodsLoadedAt: Date.now() });
    } catch (err) {
      console.warn('[nutritionStore] loadRecentFoods failed:', err);
    }
  },
}));
