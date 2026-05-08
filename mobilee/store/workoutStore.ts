// mobile/store/workoutStore.ts
import { create } from 'zustand';
import { workoutApi, WorkoutResponse } from '../services/workoutApi';
import {
  saveWorkoutLocal,
  markWorkoutSynced,
  getPendingWorkouts,
  getExercisesForWorkout,
  deleteWorkoutLocal,
  isValidUUID,
  type SetEntry,
} from '../services/database';
import { useAuthStore } from './authStore';

// ─── Типы ────────────────────────────────────────────────────────
export type { SetEntry };

export interface WorkoutExercise {
  localId:    string;
  exerciseId: string;
  name:       string;
  muscle:     string;
  setsData:   SetEntry[];
}

export type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface WorkoutState {
  exercises:    WorkoutExercise[];
  notes:        string;
  startedAt:    Date | null;
  submitStatus: SubmitStatus;
  error:        string | null;
  pendingCount: number;

  addExercise:    (ex: Omit<WorkoutExercise, 'localId'>) => void;
  removeExercise: (localId: string) => void;
  updateSetsData: (localId: string, setsData: SetEntry[]) => void;
  setNotes:       (notes: string) => void;
  startSession:   () => void;
  resetSession:   () => void;
  submitWorkout:  () => Promise<WorkoutResponse | null>;
  syncPending:    () => Promise<void>;
  loadPendingCount: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────
function computedSets(sd: SetEntry[]) {
  return sd.length;
}
function computedMaxReps(sd: SetEntry[]) {
  return sd.reduce((a, s) => Math.max(a, s.reps), 1);
}
function computedMaxWeight(sd: SetEntry[]) {
  return sd.reduce((a, s) => Math.max(a, s.weight_kg), 0);
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

  updateSetsData: (localId, setsData) =>
    set(s => ({
      exercises: s.exercises.map(e =>
        e.localId === localId ? { ...e, setsData } : e
      ),
    })),

  setNotes: (notes) => set({ notes }),

  startSession: () => set({ startedAt: new Date(), exercises: [], notes: '' }),

  resetSession: () =>
    set({ exercises: [], notes: '', startedAt: null, submitStatus: 'idle', error: null }),

  submitWorkout: async () => {
    // Guard first, then snapshot — prevents double-tap from slipping past the check
    if (get().submitStatus === 'loading' || get().submitStatus === 'success') return null;
    if (get().exercises.length === 0) return null;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      set({ submitStatus: 'error', error: 'Not signed in.' });
      return null;
    }

    set({ submitStatus: 'loading', error: null });

    const { exercises, notes, startedAt } = get();

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const today   = new Date().toISOString().split('T')[0];
    const rawDuration = startedAt
      ? Math.round((Date.now() - startedAt.getTime()) / 60_000)
      : 0;
    const durationMinutes = rawDuration >= 1 ? rawDuration : null;

    // Build flat exercise list for local SQLite storage
    const exercisesForLocal = exercises.map((ex, i) => ({
      exercise_id: ex.exerciseId,
      name:        ex.name,
      sets:        computedSets(ex.setsData),
      reps:        computedMaxReps(ex.setsData),
      weight_kg:   computedMaxWeight(ex.setsData),
      sets_data:   ex.setsData,
      order_index: i,
    }));

    // ── Шаг 1: Сохранить локально ─────────────────────────────
    try {
      await saveWorkoutLocal({
        id:               localId,
        user_id:          userId,
        workout_date:     today,
        duration_minutes: durationMinutes,
        notes:            notes || null,
        exercises:        exercisesForLocal,
      });
      set(s => ({ pendingCount: s.pendingCount + 1 }));
    } catch (dbErr) {
      console.warn('[workoutStore] SQLite save failed:', dbErr);
    }

    // ── Шаг 2: Отправить на API ───────────────────────────────
    const apiPayload = {
      workout_date:     today,
      duration_minutes: durationMinutes,
      notes:            notes || null,
      exercises: exercises.map((ex, i) => ({
        exercise_id: ex.exerciseId,
        sets_data:   ex.setsData,
        order_index: i,
      })),
    };

    try {
      const { data } = await workoutApi.createWorkout(apiPayload);
      await markWorkoutSynced(localId).catch(() => {});
      set(s => ({ pendingCount: Math.max(0, s.pendingCount - 1) }));

      set({ submitStatus: 'success' });
      setTimeout(() => get().resetSession(), 1500);

      // Clear any older backlog while we have connectivity
      get().syncPending();

      return data;
    } catch (err: any) {
      const isOffline =
        !err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error';

      if (isOffline) {
        // Already saved locally in step 1 — treat as success
        set({ submitStatus: 'success', error: null });
        setTimeout(() => get().resetSession(), 1500);
        return null;
      }

      // Real server error
      const msg = err.response?.data?.detail ?? 'Failed to save workout.';
      set({ submitStatus: 'error', error: msg });
      return null;
    }
  },

  syncPending: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      // No user logged in — nothing to sync
      return;
    }

    try {
      const pending = await getPendingWorkouts(userId);
      let cleanedZombies = 0;
      let synced = 0;
      let failed = 0;

      for (const w of pending) {
        try {
          const exercises = await getExercisesForWorkout(w.id);
          // Detect zombie workouts: any non-UUID exercise_id means it can NEVER sync
          // (fallback list IDs like 'bp', or legacy 'custom_*' offline IDs)
          const invalidExercises = exercises.filter(ex => !isValidUUID(ex.exercise_id));
          if (invalidExercises.length > 0) {
            const ids = invalidExercises.map(e => e.exercise_id).join(', ');
            console.warn(
              `[workoutStore] Deleting zombie workout ${w.id} ` +
              `(invalid exercise IDs: ${ids}) — these can never sync`,
            );
            await deleteWorkoutLocal(w.id);
            cleanedZombies++;
            continue;
          }

          const payload = {
            workout_date:     w.workout_date,
            duration_minutes: w.duration_minutes ?? null,
            notes:            w.notes ?? null,
            exercises: exercises.map(ex => ({
              exercise_id: ex.exercise_id,
              order_index: ex.order_index,
              // Use sets_data if available, otherwise fall back to legacy flat format
              ...(ex.sets_data
                ? { sets_data: ex.sets_data }
                : { sets: ex.sets, reps: ex.reps, weight_kg: ex.weight_kg }),
            })),
          };
          await workoutApi.createWorkout(payload);
          // Retry marking as synced — failure here causes duplicates on next sync
          let marked = false;
          for (let attempt = 0; attempt < 3 && !marked; attempt++) {
            try {
              await markWorkoutSynced(w.id);
              marked = true;
            } catch { /* retry */ }
          }
          if (!marked) {
            console.warn(`[workoutStore] Failed to mark workout ${w.id} as synced after 3 attempts`);
          } else {
            synced++;
          }
        } catch (syncErr: any) {
          failed++;
          // Surface the actual API error so we can see WHY a workout fails
          const status = syncErr?.response?.status;
          const detail = syncErr?.response?.data?.detail;
          const reason = detail
            ? `status=${status}, detail=${JSON.stringify(detail)}`
            : (syncErr?.message ?? String(syncErr));
          console.warn(`[workoutStore] failed to sync workout ${w.id}: ${reason}`);
        }
      }

      if (pending.length > 0) {
        console.log(
          `[workoutStore] Sync complete: ${synced} uploaded, ` +
          `${cleanedZombies} zombies cleaned, ${failed} failed`,
        );
      }
      await get().loadPendingCount();
    } catch (err) {
      console.warn('[workoutStore] syncPending failed:', err);
    }
  },

  loadPendingCount: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      set({ pendingCount: 0 });
      return;
    }
    try {
      const { getPendingCount } = await import('../services/database');
      const cnt = await getPendingCount(userId);
      set({ pendingCount: cnt });
    } catch (err) {
      // Retain previous pendingCount — setting to 0 hides the sync indicator
      console.warn('[workoutStore] loadPendingCount failed:', err);
    }
  },
}));

// ─── Selectors ────────────────────────────────────────────────────
export function selectTotalReps(exercises: WorkoutExercise[]) {
  return exercises.reduce(
    (a, e) => a + e.setsData.reduce((b, s) => b + s.reps, 0),
    0
  );
}

export function selectTotalVolume(exercises: WorkoutExercise[]) {
  return exercises.reduce(
    (a, e) => a + e.setsData.reduce((b, s) => b + s.reps * s.weight_kg, 0),
    0
  );
}
