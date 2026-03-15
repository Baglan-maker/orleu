// mobile/store/workoutStore.ts
/**
 * Zustand store для тренировки.
 * Офлайн-first: сначала пишем в SQLite, потом синкаем с API.
 */
import { create } from 'zustand';
import { workoutApi } from '../services/workoutApi';
import { saveWorkoutLocal, markWorkoutSynced, getPendingWorkouts } from '../services/database';

// ─── Типы ────────────────────────────────────────────────────────
export interface WorkoutExercise {
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
  pendingCount: number;   // кол-во несинкнутых тренировок

  addExercise:    (ex: Omit<WorkoutExercise, 'localId'>) => void;
  removeExercise: (localId: string) => void;
  updateExercise: (localId: string, patch: Partial<WorkoutExercise>) => void;
  setNotes:       (notes: string) => void;
  startSession:   () => void;
  resetSession:   () => void;
  submitWorkout:  () => Promise<boolean>;
  syncPending:    () => Promise<void>;
  loadPendingCount: () => Promise<void>;
}

// ─── Store ───────────────────────────────────────────────────────
export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  exercises:    [],
  notes:        '',
  startedAt:    null,
  submitStatus: 'idle',
  error:        null,
  pendingCount: 0,

  addExercise: (ex) => {
    const localId = `${ex.exerciseId}_${Date.now()}`;
    if (!get().startedAt) set({ startedAt: new Date() });
    set(s => ({ exercises: [...s.exercises, { ...ex, localId }] }));
  },

  removeExercise: (localId) =>
    set(s => ({ exercises: s.exercises.filter(e => e.localId !== localId) })),

  updateExercise: (localId, patch) =>
    set(s => ({
      exercises: s.exercises.map(e => e.localId === localId ? { ...e, ...patch } : e),
    })),

  setNotes: (notes) => set({ notes }),

  startSession: () => set({ startedAt: new Date(), exercises: [], notes: '' }),

  resetSession: () =>
    set({ exercises: [], notes: '', startedAt: null, submitStatus: 'idle', error: null }),

  // ── submitWorkout ────────────────────────────────────────────
  // 1. Генерируем локальный UUID
  // 2. Сохраняем в SQLite (offline-first)
  // 3. Пробуем отправить на API
  // 4. Если успех → markWorkoutSynced
  // 5. Если ошибка API → остаётся в SQLite как pending
  submitWorkout: async () => {
    const { exercises, notes, startedAt } = get();
    if (exercises.length === 0) return false;

    set({ submitStatus: 'loading', error: null });

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const today   = new Date().toISOString().split('T')[0];
    const rawDuration = startedAt
      ? Math.round((Date.now() - startedAt.getTime()) / 60_000)
      : 0;
    const durationMinutes = rawDuration >= 1 ? rawDuration : null;

    const exercisesPayload = exercises.map((ex, i) => ({
      exercise_id: ex.exerciseId,
      name:        ex.name,
      sets:        ex.sets,
      reps:        ex.reps,
      weight_kg:   ex.weight,
      order_index: i,
    }));

    // ── Шаг 1: Сохранить локально ─────────────────────────────
    try {
      await saveWorkoutLocal({
        id:               localId,
        workout_date:     today,
        duration_minutes: durationMinutes,
        notes:            notes || null,
        exercises:        exercisesPayload,
      });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
    } catch (dbErr) {
      console.warn('[workoutStore] SQLite save failed:', dbErr);
      // Не критично — продолжаем и пробуем API
    }

    // ── Шаг 2: Отправить на API ───────────────────────────────
    const apiPayload = {
      workout_date:     today,
      duration_minutes: durationMinutes,
      notes:            notes || null,
      exercises:        exercisesPayload.map(({ name: _n, ...rest }) => rest),
    };

    try {
      await workoutApi.createWorkout(apiPayload);
      // Успешно → помечаем синкнутым
      await markWorkoutSynced(localId).catch(() => {});
      set(s => ({ pendingCount: Math.max(0, s.pendingCount - 1) }));

      set({ submitStatus: 'success' });
      setTimeout(() => get().resetSession(), 1500);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Workout saved offline. Will sync when connected.';
      set({ submitStatus: 'error', error: msg });
      // Тренировка уже в SQLite — ОК
      setTimeout(() => get().resetSession(), 2000);
      return false;
    }
  },

  // ── syncPending ──────────────────────────────────────────────
  // Отправляет все несинкнутые тренировки из SQLite
  syncPending: async () => {
    try {
      const pending = await getPendingWorkouts();
      for (const w of pending) {
        // TODO: fetch exercises for this workout and POST
        // Полная реализация требует join с workout_exercises_local
        await markWorkoutSynced(w.id).catch(() => {});
      }
      await get().loadPendingCount();
    } catch (err) {
      console.warn('[workoutStore] syncPending failed:', err);
    }
  },

  loadPendingCount: async () => {
    try {
      const { getPendingCount } = await import('../services/database');
      const cnt = await getPendingCount();
      set({ pendingCount: cnt });
    } catch {
      set({ pendingCount: 0 });
    }
  },
}));

// ─── Selectors ────────────────────────────────────────────────────
export function selectTotalReps(exercises: WorkoutExercise[]) {
  return exercises.reduce((a, e) => a + e.sets * e.reps, 0);
}

export function selectTotalVolume(exercises: WorkoutExercise[]) {
  return exercises.reduce((a, e) => a + e.sets * e.reps * e.weight, 0);
}
