// mobile/services/syncWorker.ts
/**
 * Syncs pending offline workouts to the server.
 * Called on app foreground (AppState 'active') and after successful online submissions.
 */
import { useWorkoutStore } from '../store/workoutStore';

let syncing = false;

export async function syncPendingWorkouts(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    await useWorkoutStore.getState().syncPending();
  } finally {
    syncing = false;
  }
}
