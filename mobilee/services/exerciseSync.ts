// mobile/services/exerciseSync.ts
/**
 * Синк упражнений из бэкенда в SQLite.
 * Вызывается один раз после первого входа (или если кэш пустой).
 */
import { isExerciseCacheSynced, cacheExercises } from './database';
import { exerciseApi } from './workoutApi';

/** Загрузить упражнения с сервера и сохранить в SQLite */
export async function syncExerciseLibrary(): Promise<boolean> {
  try {
    const alreadySynced = await isExerciseCacheSynced();
    if (alreadySynced) return true;

    const { data } = await exerciseApi.getAll();

    // Бэкенд возвращает либо массив напрямую, либо { exercises: [...] }
    const exercises: any[] = Array.isArray(data) ? data : (data as any).exercises ?? [];

    if (!exercises.length) return false;

    await cacheExercises(
      exercises.map((ex: any) => ({
        id:           ex.id,
        name:         ex.name,
        muscle_group: ex.muscle_group,
        category:     ex.category ?? 'compound',
        is_custom:    ex.is_custom ? 1 : 0,
      }))
    );

    return true;
  } catch (err) {
    console.warn('[exerciseSync] Failed:', err);
    return false;
  }
}

/** Принудительно сбросить флаг синка (для тестирования / обновления) */
export async function resetExerciseSync(): Promise<void> {
  const { getDb } = await import('./database');
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('exercise_cache_synced', 'false')"
  );
}
