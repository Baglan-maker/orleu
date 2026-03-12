// mobile/store/workoutStore.ts
/**
 * Zustand store для тренировки.
 * Отвечает за:
 * - Текущую активную сессию (список упражнений)
 * - Отправку тренировки на сервер
 * - Состояние загрузки / ошибок
 *
 * Использование в компоненте:
 *   const { exercises, addExercise, submitWorkout } = useWorkoutStore();
 */
import { create } from 'zustand';
import { workoutApi } from '../services/workoutApi';

// ─── Типы ────────────────────────────────────────────────────────
export interface WorkoutExercise {
  /** Локальный ID для React key (не UUID из БД) */
  localId:    string;
  exerciseId: string;
  name:       string;
  muscle:     string;
  sets:       number;
  reps:       number;
  weight:     number;
}

export type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface WorkoutState {
  exercises:    WorkoutExercise[];
  notes:        string;
  startedAt:    Date | null;
  submitStatus: SubmitStatus;
  error:        string | null;

  // Методы
  addExercise:    (ex: Omit<WorkoutExercise, 'localId'>) => void;
  removeExercise: (localId: string) => void;
  updateExercise: (localId: string, patch: Partial<WorkoutExercise>) => void;
  setNotes:       (notes: string) => void;
  startSession:   () => void;
  resetSession:   () => void;
  submitWorkout:  () => Promise<boolean>;
}

// ─── Store ───────────────────────────────────────────────────────
export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  exercises:    [],
  notes:        '',
  startedAt:    null,
  submitStatus: 'idle',
  error:        null,

  // ── addExercise ──────────────────────────────────────────────
  addExercise: (ex) => {
    const localId = `${ex.exerciseId}_${Date.now()}`;
    // Если сессия ещё не начата — фиксируем время старта
    if (!get().startedAt) {
      set({ startedAt: new Date() });
    }
    set(s => ({ exercises: [...s.exercises, { ...ex, localId }] }));
  },

  // ── removeExercise ───────────────────────────────────────────
  removeExercise: (localId) =>
    set(s => ({ exercises: s.exercises.filter(e => e.localId !== localId) })),

  // ── updateExercise ───────────────────────────────────────────
  updateExercise: (localId, patch) =>
    set(s => ({
      exercises: s.exercises.map(e =>
        e.localId === localId ? { ...e, ...patch } : e
      ),
    })),

  setNotes: (notes) => set({ notes }),

  // ── startSession ─────────────────────────────────────────────
  startSession: () => set({ startedAt: new Date(), exercises: [], notes: '' }),

  // ── resetSession ─────────────────────────────────────────────
  resetSession: () =>
    set({ exercises: [], notes: '', startedAt: null, submitStatus: 'idle', error: null }),

  // ── submitWorkout ────────────────────────────────────────────
  /**
   * Формирует тело запроса из текущей сессии и отправляет на бэкенд.
   * Возвращает true если успешно, false если ошибка.
   *
   * Формат для POST /api/workouts:
   * {
   *   workout_date: "2026-03-12",
   *   duration_minutes: 45,
   *   notes: "...",
   *   exercises: [
   *     { exercise_id: "uuid", sets: 3, reps: 10, weight_kg: 80, order_index: 0 }
   *   ]
   * }
   */
  submitWorkout: async () => {
    const { exercises, notes, startedAt } = get();
    if (exercises.length === 0) return false;

    set({ submitStatus: 'loading', error: null });

    // Вычисляем длительность в минутах
    const durationMinutes = startedAt
      ? Math.round((Date.now() - startedAt.getTime()) / 60_000)
      : null;

    // Сегодняшняя дата в формате YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    const payload = {
      workout_date:     today,
      duration_minutes: durationMinutes,
      notes:            notes || null,
      exercises:        exercises.map((ex, i) => ({
        exercise_id: ex.exerciseId,
        sets:        ex.sets,
        reps:        ex.reps,
        weight_kg:   ex.weight,
        order_index: i,
      })),
    };

    try {
      await workoutApi.createWorkout(payload);
      set({ submitStatus: 'success' });
      // Очищаем сессию через 1.5с чтобы юзер увидел "saved"
      setTimeout(() => get().resetSession(), 1500);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to save workout. Try again.';
      set({ submitStatus: 'error', error: msg });
      return false;
    }
  },
}));

// ─── Derived selectors (используй в компонентах) ─────────────────
export function selectTotalReps(exercises: WorkoutExercise[]) {
  return exercises.reduce((a, e) => a + e.sets * e.reps, 0);
}

export function selectTotalVolume(exercises: WorkoutExercise[]) {
  return exercises.reduce((a, e) => a + e.sets * e.reps * e.weight, 0);
}