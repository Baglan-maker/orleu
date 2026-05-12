// mobile/services/workoutApi.ts
/**
 * All API calls for exercises and workouts.
 * Each function corresponds to one endpoint on the backend.
 */
import { api } from './api';

// ─── Types (server responses) ─────────────────────────────────────
export interface ExerciseResponse {
  id:           string;
  name:         string;
  alias:        string | null;
  muscle_group: string;
  category:     string;
  is_custom:    boolean;
}

export interface SetEntry {
  set_number: number;
  reps:       number;
  weight_kg:  number;
}

export interface WorkoutExercisePayload {
  exercise_id: string;
  order_index: number;
  // Per-set format (preferred)
  sets_data?:  SetEntry[];
  // Legacy flat format (backward compat)
  sets?:       number;
  reps?:       number;
  weight_kg?:  number;
}

export interface CreateWorkoutPayload {
  workout_date:     string;          // "YYYY-MM-DD"
  duration_minutes: number | null;
  notes:            string | null;
  exercises:        WorkoutExercisePayload[];
}

export interface WorkoutExerciseResponse {
  id:            string;
  exercise_id:   string;
  exercise_name: string;
  muscle_group:  string;
  sets:          number;
  reps:          number;
  weight_kg:     number;
  sets_data:     SetEntry[] | null;
  notes:         string | null;
  order_index:   number;
  total_volume:  number;
}

export interface AchievementEarned {
  id:          string;
  name:        string;
  description: string;
  icon_key:    string;
}

export interface PRResult {
  exercise_id:   string;
  exercise_name: string;
  new_weight:    number;
  prev_weight:   number;
  delta:         number;
}

export interface ChapterCompleted {
  chapter_number:    number;
  xp:                number;
  coins:             number;
  campaign_complete: boolean;
}

export interface WorkoutResponse {
  id:               string;
  user_id:          string;
  workout_date:     string;
  duration_minutes: number | null;
  notes:            string | null;
  synced:           boolean;
  exercises:        WorkoutExerciseResponse[];
  total_volume:     number;
  xp_gained:        number | null;
  new_level:        number | null;
  leveled_up:       boolean;
  achievements:     AchievementEarned[];
  new_prs:          PRResult[];
  chapter_completed: ChapterCompleted | null;
  created_at:       string;
  updated_at:       string;
}

export interface PRCurrentItem {
  exercise_id:    string;
  exercise_name:  string;
  muscle_group:   string;
  weight_kg:      number;
  achieved_at:    string;
  total_pr_count: number;
}

// ─── PR API ───────────────────────────────────────────────────────
export const prsApi = {
  getAll: () =>
    api.get<PRCurrentItem[]>('/api/prs'),

  getHistory: (exerciseId: string) =>
    api.get<{ id: string; weight_kg: number; achieved_at: string }[]>(
      `/api/prs/${exerciseId}`
    ),
};

// List endpoint returns a lighter object (no exercises array)
export interface WorkoutListItem {
  id:               string;
  workout_date:     string;
  duration_minutes: number | null;
  notes:            string | null;
  total_exercises:  number;
  total_volume:     number;
  created_at:       string;
}
export interface WorkoutListResponse {
  items:  WorkoutListItem[];
  total:  number;
  limit:  number;
  offset: number;
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
      name:         data.name,
      muscle_group: data.muscle_group.toLowerCase(),
      category:     (data.category ?? 'compound').toLowerCase(),
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
    api.get<WorkoutListResponse>('/api/workouts', {
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