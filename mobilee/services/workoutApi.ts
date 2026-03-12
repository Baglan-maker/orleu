// mobile/services/workoutApi.ts
/**
 * Все API вызовы для упражнений и тренировок.
 * Каждая функция соответствует одному endpoint на бэкенде.
 */
import { api } from './api';

// ─── Типы (ответы от сервера) ─────────────────────────────────────
export interface ExerciseResponse {
  id:           string;
  name:         string;
  alias:        string | null;
  muscle_group: string;
  category:     string;
  is_custom:    boolean;
}

export interface WorkoutExercisePayload {
  exercise_id: string;
  sets:        number;
  reps:        number;
  weight_kg:   number;
  order_index: number;
}

export interface CreateWorkoutPayload {
  workout_date:     string;          // "YYYY-MM-DD"
  duration_minutes: number | null;
  notes:            string | null;
  exercises:        WorkoutExercisePayload[];
}

export interface WorkoutResponse {
  id:               string;
  workout_date:     string;
  duration_minutes: number | null;
  notes:            string | null;
  exercises:        Array<WorkoutExercisePayload & { id: string }>;
  created_at:       string;
}

// ─── Exercise API ─────────────────────────────────────────────────
export const exerciseApi = {
  /**
   * GET /api/exercises?q=bench&limit=20
   * Поиск упражнений. Вызывается при вводе в поле поиска.
   * Когда API готов — заменяет локальный EXERCISE_LIBRARY в модалке.
   */
  search: (query: string, limit = 20) =>
    api.get<ExerciseResponse[]>('/api/exercises', {
      params: { q: query, limit },
    }),

  /**
   * POST /api/exercises
   * Создаёт кастомное упражнение для данного юзера.
   */
  create: (data: { name: string; muscle_group: string; category?: string }) =>
    api.post<ExerciseResponse>('/api/exercises', {
      ...data,
      category:  data.category ?? 'compound',
      is_custom: true,
    }),

  /**
   * GET /api/exercises/cache
   * Возвращает весь список для офлайн-кэша (SQLite).
   * Вызывается один раз при старте + раз в неделю.
   */
  getAll: () =>
    api.get<ExerciseResponse[]>('/api/exercises/cache'),
};

// ─── Workout API ──────────────────────────────────────────────────
export const workoutApi = {
  /**
   * POST /api/workouts
   * Создаёт тренировку с упражнениями.
   * Основной вызов из workoutStore.submitWorkout().
   */
  createWorkout: (data: CreateWorkoutPayload) =>
    api.post<WorkoutResponse>('/api/workouts', data),

  /**
   * GET /api/workouts?limit=10&offset=0
   * История тренировок для экрана Stats.
   */
  getHistory: (limit = 10, offset = 0) =>
    api.get<WorkoutResponse[]>('/api/workouts', {
      params: { limit, offset },
    }),

  /**
   * GET /api/workouts/:id
   * Детали конкретной тренировки.
   */
  getById: (id: string) =>
    api.get<WorkoutResponse>(`/api/workouts/${id}`),

  /**
   * DELETE /api/workouts/:id
   * Удалить тренировку.
   */
  delete: (id: string) =>
    api.delete(`/api/workouts/${id}`),
};