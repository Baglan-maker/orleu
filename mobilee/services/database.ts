// mobile/services/database.ts
/**
 * SQLite service — офлайн хранилище для:
 * - Кэша упражнений (exercise_library_cache)
 * - Локальных тренировок до синка с сервером (workouts_local)
 * - Метаданных приложения (app_meta)
 */
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync('orleu.db');

  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS exercise_library_cache (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'compound',
      is_custom    INTEGER NOT NULL DEFAULT 0,
      synced_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS workouts_local (
      id               TEXT PRIMARY KEY,
      workout_date     TEXT NOT NULL,
      duration_minutes INTEGER,
      notes            TEXT,
      synced           INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_exercises_local (
      id               TEXT PRIMARY KEY,
      workout_local_id TEXT NOT NULL,
      exercise_id      TEXT NOT NULL,
      name             TEXT NOT NULL,
      sets             INTEGER NOT NULL DEFAULT 1,
      reps             INTEGER NOT NULL DEFAULT 1,
      weight_kg        REAL NOT NULL DEFAULT 0,
      order_index      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  return _db;
}

// ─── Types ────────────────────────────────────────────────────────
export interface CachedExercise {
  id:           string;
  name:         string;
  muscle_group: string;
  category:     string;
  is_custom:    number;
}

export interface LocalWorkoutExercise {
  exercise_id: string;
  name:        string;
  sets:        number;
  reps:        number;
  weight_kg:   number;
  order_index: number;
}

export interface LocalWorkout {
  id:               string;
  workout_date:     string;
  duration_minutes: number | null;
  notes:            string | null;
  exercises:        LocalWorkoutExercise[];
}

// ─── Exercise cache ────────────────────────────────────────────────
export async function cacheExercises(exercises: CachedExercise[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const ex of exercises) {
      await db.runAsync(
        `INSERT OR REPLACE INTO exercise_library_cache
           (id, name, muscle_group, category, is_custom, synced_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [ex.id, ex.name, ex.muscle_group, ex.category, ex.is_custom ? 1 : 0]
      );
    }
  });
  await setMeta('exercise_cache_synced', 'true');
}

export async function searchExercises(
  query: string,
  muscleFilter: string
): Promise<CachedExercise[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (muscleFilter && muscleFilter !== 'All') {
    conditions.push('muscle_group = ?');
    params.push(muscleFilter);
  }
  if (query.trim()) {
    conditions.push('name LIKE ?');
    params.push(`%${query.trim()}%`);
  }

  let sql = 'SELECT * FROM exercise_library_cache';
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY is_custom ASC, name ASC LIMIT 60';

  return db.getAllAsync<CachedExercise>(sql, params);
}

export async function isExerciseCacheSynced(): Promise<boolean> {
  const val = await getMeta('exercise_cache_synced');
  return val === 'true';
}

export async function getCachedExerciseCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM exercise_library_cache'
  );
  return row?.cnt ?? 0;
}

// ─── Local workout storage ─────────────────────────────────────────
export async function saveWorkoutLocal(workout: LocalWorkout): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO workouts_local
         (id, workout_date, duration_minutes, notes, synced, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      [
        workout.id,
        workout.workout_date,
        workout.duration_minutes ?? null,
        workout.notes ?? null,
      ]
    );

    for (const ex of workout.exercises) {
      const exRowId = `${workout.id}_${ex.order_index}`;
      await db.runAsync(
        `INSERT OR REPLACE INTO workout_exercises_local
           (id, workout_local_id, exercise_id, name, sets, reps, weight_kg, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exRowId,
          workout.id,
          ex.exercise_id,
          ex.name,
          ex.sets,
          ex.reps,
          ex.weight_kg,
          ex.order_index,
        ]
      );
    }
  });
}

export async function getPendingWorkouts(): Promise<any[]> {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM workouts_local WHERE synced = 0 ORDER BY created_at ASC'
  );
}

export async function markWorkoutSynced(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workouts_local SET synced = 1 WHERE id = ?', [localId]);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM workouts_local WHERE synced = 0'
  );
  return row?.cnt ?? 0;
}

// ─── App meta ──────────────────────────────────────────────────────
async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export { getDb };
