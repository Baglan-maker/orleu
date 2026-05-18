/**
 * Syncs pending offline workouts to the server.
 * Called on app foreground (AppState 'active') and after successful online submissions.
 *
 * Uses a Promise-based lock: concurrent callers share the same sync promise
 * instead of racing on a boolean flag.
 */
import { useWorkoutStore } from '../store/workoutStore';

let syncPromise: Promise<void> | null = null;

export async function syncPendingWorkouts(): Promise<void> {
  if (syncPromise) return syncPromise;
  syncPromise = useWorkoutStore
    .getState()
    .syncPending()
    .finally(() => {
      syncPromise = null;
    });
  return syncPromise;
}
