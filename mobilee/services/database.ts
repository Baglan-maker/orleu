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
      sets_data        TEXT,
      order_index      INTEGER NOT NULL DEFAULT 0
    );

    -- Migrate existing table: add sets_data if missing (idempotent)
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      key TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS nutrition_logs_pending (
      id           TEXT PRIMARY KEY,
      food_item_id TEXT NOT NULL,
      quantity_g   REAL NOT NULL,
      meal_type    TEXT NOT NULL,
      date         TEXT NOT NULL,
      synced       INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL
    );
  `);

  // Migrate existing installs: add sets_data column if absent
  try {
    await _db.execAsync(
      `ALTER TABLE workout_exercises_local ADD COLUMN sets_data TEXT`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Only silence "duplicate column" errors — surface anything else
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.error('[database] Failed to add sets_data column:', msg);
    }
  }

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

export interface SetEntry {
  set_number: number;
  reps:       number;
  weight_kg:  number;
}

export interface LocalWorkoutExercise {
  exercise_id: string;
  name:        string;
  sets:        number;
  reps:        number;
  weight_kg:   number;
  sets_data:   SetEntry[] | null;
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
           (id, workout_local_id, exercise_id, name, sets, reps, weight_kg, sets_data, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exRowId,
          workout.id,
          ex.exercise_id,
          ex.name,
          ex.sets,
          ex.reps,
          ex.weight_kg,
          ex.sets_data ? JSON.stringify(ex.sets_data) : null,
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

interface RawLocalExercise {
  exercise_id: string;
  name:        string;
  sets:        number;
  reps:        number;
  weight_kg:   number;
  sets_data:   string | null;
  order_index: number;
}

export async function getExercisesForWorkout(workoutLocalId: string): Promise<LocalWorkoutExercise[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RawLocalExercise>(
    'SELECT exercise_id, name, sets, reps, weight_kg, sets_data, order_index FROM workout_exercises_local WHERE workout_local_id = ? ORDER BY order_index ASC',
    [workoutLocalId]
  );
  return rows.map(r => ({
    ...r,
    sets_data: r.sets_data ? JSON.parse(r.sets_data) as SetEntry[] : null,
  }));
}

/** Returns the sets_data from the most recent logged session for this exercise. */
export async function getLastSessionSetsData(exerciseId: string): Promise<SetEntry[] | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ sets_data: string | null }>(
    `SELECT wel.sets_data
     FROM workout_exercises_local wel
     JOIN workouts_local wl ON wl.id = wel.workout_local_id
     WHERE wel.exercise_id = ?
     ORDER BY wl.created_at DESC
     LIMIT 1`,
    [exerciseId]
  );
  if (!row?.sets_data) return null;
  return JSON.parse(row.sets_data) as SetEntry[];
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

// ─── Nutrition pending logs ────────────────────────────────────────
export interface PendingNutritionLog {
  id:           string;
  food_item_id: string;
  quantity_g:   number;
  meal_type:    string;
  date:         string;
}

export async function saveNutritionLogPending(log: PendingNutritionLog): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO nutrition_logs_pending
       (id, food_item_id, quantity_g, meal_type, date, synced, created_at)
     VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
    [log.id, log.food_item_id, log.quantity_g, log.meal_type, log.date]
  );
}

export async function getPendingNutritionLogs(): Promise<PendingNutritionLog[]> {
  const db = await getDb();
  return db.getAllAsync<PendingNutritionLog>(
    'SELECT id, food_item_id, quantity_g, meal_type, date FROM nutrition_logs_pending WHERE synced = 0 ORDER BY created_at ASC'
  );
}

export async function markNutritionLogSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE nutrition_logs_pending SET synced = 1 WHERE id = ?', [id]);
}

export { getDb };
