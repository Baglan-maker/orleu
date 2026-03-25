# ORLEU — Project Documentation
**Version:** 1.0 · **Date:** March 2026 · **Status:** In Development

> Этот документ — единственный источник правды по проекту. Написан для быстрого онбординга нового бэкенд-разработчика и передачи контекста AI-агентам.

---

## 1. Обзор проекта

**Orleu** (Өрлеу — «Восхождение») — адаптивное геймифицированное приложение для отслеживания тренировок в зале. Дипломный проект Астанинского IT университета (AITU).

**Авторы:** Багдат, Нурмухаммед, Адилет  
**Дедлайн:** MVP — 31 марта 2026, итоговая защита — 15 мая 2026

### Ключевая идея
ML-модель (LightGBM) раз в ночь анализирует тренировочные данные и классифицирует прогресс пользователя как **Improving / Plateau / Declining**. На основе этого динамически меняются:
- сложность и цели миссий
- нарративные развилки кампании
- тон сообщений AI-коуча

---

## 2. Технический стек

| Слой | Технология |
|------|-----------|
| Mobile | React Native + Expo SDK 54, Expo Router v3 |
| State | Zustand v4 |
| HTTP | Axios (с JWT interceptors) |
| Secure storage | expo-secure-store |
| Backend | FastAPI (Python) |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Database | PostgreSQL (server) + SQLite (mobile offline cache) |
| ML | LightGBM + SHAP |
| Scheduler | APScheduler (nightly job 00:00) |
| Auth | JWT — access token 15min (stateless) + refresh token 7d (stored hashed in DB) |

---

## 3. Монорепо структура

```
orleu/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings (pydantic-settings, читает .env)
│   │   ├── api/                 # Роутеры: auth, workouts, exercises, missions, campaigns, progress, predictions, coach
│   │   ├── models/              # SQLAlchemy ORM models
│   │   │   └── models.py        # ВСЕ таблицы в одном файле
│   │   ├── schemas/             # Pydantic schemas (request/response)
│   │   ├── services/            # Бизнес-логика
│   │   │   ├── auth_utils.py    # JWT, bcrypt, token generation
│   │   │   ├── dependencies.py  # get_current_user dependency
│   │   │   ├── ml_service.py    # LightGBM predict
│   │   │   ├── gamification_service.py  # XP, missions, level up
│   │   │   └── coach_service.py # Генерация сообщений коуча
│   │   ├── tasks/
│   │   │   ├── nightly_ml.py    # APScheduler job (00:00)
│   │   │   └── mission_reset.py # Сброс миссий (понедельник)
│   │   └── db/
│   │       └── database.py      # SQLAlchemy engine, SessionLocal, get_db
│   ├── ml/
│   │   ├── features.py          # Feature engineering
│   │   ├── train.py             # Обучение модели
│   │   └── predict.py           # Inference
│   ├── alembic/                 # Миграции БД
│   ├── requirements.txt
│   └── .env                     # (не в git) DATABASE_URL, SECRET_KEY, ...
└── mobile/
    ├── app/
    │   ├── _layout.tsx          # Root layout + auth guard
    │   ├── (auth)/
    │   │   ├── login.tsx
    │   │   └── register.tsx
    │   └── (tabs)/
    │       ├── index.tsx        # Workout Log
    │       ├── campaign.tsx     # Campaign Map
    │       ├── missions.tsx     # Missions
    │       └── stats.tsx        # Stats/Progress
    ├── components/
    │   ├── ui/                  # Button, Input, Card, ProgressBar
    │   └── workout/             # ExerciseSearchModal
    ├── constants/
    │   └── theme.ts             # ВСЕ цвета, шрифты, размеры
    ├── services/
    │   ├── api.ts               # Axios instance + JWT interceptors
    │   ├── storage.ts           # SecureStore wrapper
    │   └── workoutApi.ts        # Exercise + Workout API calls
    └── store/
        ├── authStore.ts         # Zustand: auth state
        └── workoutStore.ts      # Zustand: active workout session
```

---

## 4. База данных — ERD (актуальная версия)

### Домен: AUTH

```sql
USERS
  id               UUID PK (gen_random_uuid())
  email            VARCHAR(255) UNIQUE NOT NULL
  password_hash    VARCHAR(255) NOT NULL
  name             VARCHAR(100) NOT NULL
  avatar_theme_id  SMALLINT DEFAULT 0          -- 0..3
  experience_level VARCHAR(20) NOT NULL         -- 'beginner'|'intermediate'|'advanced'
  primary_goal     VARCHAR(20) NOT NULL         -- 'strength'|'hypertrophy'|'endurance'
  onboarding_done  BOOLEAN DEFAULT false
  created_at       TIMESTAMPTZ DEFAULT now()
  updated_at       TIMESTAMPTZ DEFAULT now()

USER_SESSIONS
  id                  UUID PK
  user_id             UUID FK → users.id ON DELETE CASCADE
  refresh_token_hash  VARCHAR(255) UNIQUE NOT NULL  -- SHA256 хеш токена
  device_info         VARCHAR(255)
  expires_at          TIMESTAMPTZ NOT NULL
  created_at          TIMESTAMPTZ DEFAULT now()
```

### Домен: WORKOUT

```sql
EXERCISE_LIBRARY
  id           UUID PK
  name         VARCHAR(100) NOT NULL
  alias        VARCHAR(100)                     -- альт. название для поиска
  muscle_group VARCHAR(30) NOT NULL             -- 'chest'|'back'|'shoulders'|'arms'|'legs'|'core'|'full_body'
  category     VARCHAR(20) NOT NULL             -- 'compound'|'isolation'|'cardio'|'bodyweight'
  is_custom    BOOLEAN DEFAULT false
  created_by   UUID FK → users.id (NULL если системное)
  created_at   TIMESTAMPTZ DEFAULT now()
  -- GIN index на name для full-text поиска

WORKOUTS
  id               UUID PK
  user_id          UUID FK → users.id ON DELETE CASCADE
  workout_date     DATE NOT NULL
  duration_minutes INTEGER                       -- ML feature
  notes            TEXT
  synced           BOOLEAN DEFAULT true          -- false если создан офлайн
  created_at       TIMESTAMPTZ DEFAULT now()
  updated_at       TIMESTAMPTZ DEFAULT now()
  -- INDEX ON (user_id, workout_date DESC)

WORKOUT_EXERCISES
  id          UUID PK
  workout_id  UUID FK → workouts.id ON DELETE CASCADE
  exercise_id UUID FK → exercise_library.id
  sets        INTEGER NOT NULL
  reps        INTEGER NOT NULL
  weight_kg   FLOAT NOT NULL DEFAULT 0.0
  notes       TEXT
  order_index INTEGER DEFAULT 0
  -- ВАЖНО: total_volume НЕ хранится — вычисляется как sets * reps * weight_kg
```

### Домен: GAMIFICATION

```sql
CAMPAIGNS
  id             UUID PK
  name           VARCHAR(100) NOT NULL
  description    TEXT
  total_chapters INTEGER NOT NULL
  order_index    INTEGER NOT NULL
  is_active      BOOLEAN DEFAULT true

CAMPAIGN_CHAPTERS
  id             UUID PK
  campaign_id    UUID FK → campaigns.id ON DELETE CASCADE
  chapter_number INTEGER NOT NULL
  title          VARCHAR(100) NOT NULL
  narrative_text TEXT
  has_branch     BOOLEAN DEFAULT false
  branch_a_label VARCHAR(100)
  branch_b_label VARCHAR(100)
  UNIQUE(campaign_id, chapter_number)

USER_PROGRESS
  user_id             UUID PK FK → users.id ON DELETE CASCADE
  xp                  INTEGER DEFAULT 0
  level               INTEGER DEFAULT 1
  coins               INTEGER DEFAULT 0
  current_streak      INTEGER DEFAULT 0
  longest_streak      INTEGER DEFAULT 0
  current_campaign_id UUID FK → campaigns.id
  current_chapter_id  UUID FK → campaign_chapters.id
  campaign_path       VARCHAR(1)                  -- 'A' или 'B' на развилке
  last_workout_at     TIMESTAMPTZ
  updated_at          TIMESTAMPTZ DEFAULT now()

MISSION_TEMPLATES
  id                   UUID PK
  name                 VARCHAR(100) NOT NULL
  type                 VARCHAR(20) NOT NULL        -- 'volume'|'consistency'|'intensity'|'variety'
  description_template VARCHAR(255) NOT NULL       -- "Complete {target} reps this week"
  base_target          FLOAT NOT NULL
  difficulty_scale     FLOAT NOT NULL DEFAULT 1.0
  base_xp              INTEGER NOT NULL
  base_coins           INTEGER NOT NULL
  campaign_path_filter VARCHAR(1)                  -- NULL=все, 'A'/'B'=только для этого пути
  duration_days        INTEGER NOT NULL DEFAULT 7

USER_MISSIONS
  id                  UUID PK
  user_id             UUID FK → users.id ON DELETE CASCADE
  mission_template_id UUID FK → mission_templates.id
  adjusted_target     FLOAT NOT NULL               -- base_target × ML difficulty factor
  current_progress    FLOAT DEFAULT 0.0
  status              VARCHAR(20) DEFAULT 'active' -- 'active'|'completed'|'expired'|'abandoned'
  xp_awarded          INTEGER                      -- NULL до выполнения
  coins_awarded       INTEGER                      -- NULL до выполнения
  started_at          TIMESTAMPTZ DEFAULT now()
  expires_at          TIMESTAMPTZ NOT NULL
  completed_at        TIMESTAMPTZ

SKILL_TREE_NODES
  node_id              UUID PK
  name                 VARCHAR(100) NOT NULL
  benefit_description  TEXT NOT NULL
  unlock_cost_coins    INTEGER NOT NULL
  prerequisite_node_id UUID FK → skill_tree_nodes.node_id (self-referential)

USER_SKILL_TREE
  user_id     UUID FK → users.id
  node_id     UUID FK → skill_tree_nodes.node_id
  unlocked_at TIMESTAMPTZ DEFAULT now()
  UNIQUE(user_id, node_id)

ACHIEVEMENTS
  id              UUID PK
  name            VARCHAR(100) NOT NULL
  description     VARCHAR(255) NOT NULL
  icon_key        VARCHAR(50) NOT NULL
  condition_type  VARCHAR(50) NOT NULL   -- 'streak_days'|'total_sessions'|'pr_count'|'missions_completed'
  condition_value INTEGER NOT NULL

USER_ACHIEVEMENTS
  user_id        UUID FK → users.id
  achievement_id UUID FK → achievements.id
  earned_at      TIMESTAMPTZ DEFAULT now()
  UNIQUE(user_id, achievement_id)
```

### Домен: ML

```sql
ML_PREDICTIONS
  id              UUID PK
  user_id         UUID FK → users.id ON DELETE CASCADE
  prediction_date DATE NOT NULL
  trend           VARCHAR(20) NOT NULL      -- 'improving'|'plateau'|'declining'
  confidence      FLOAT NOT NULL
  features_json   JSON                      -- {weekly_volume_delta, session_frequency, load_progression, consistency_score}
  shap_values     JSON                      -- для интерпретации (нужно для диплома)
  model_version   VARCHAR(20) NOT NULL      -- 'lgbm_v1.0.0'
  created_at      TIMESTAMPTZ DEFAULT now()
  UNIQUE(user_id, prediction_date)
  INDEX ON (user_id, prediction_date DESC)

COACH_MESSAGES
  id            UUID PK
  user_id       UUID FK → users.id ON DELETE CASCADE
  prediction_id UUID FK → ml_predictions.id
  message_text  TEXT NOT NULL
  tone          VARCHAR(20) NOT NULL        -- 'encouraging'|'neutral'|'supportive'
  is_read       BOOLEAN DEFAULT false
  created_at    TIMESTAMPTZ DEFAULT now()
  -- Partial index: ON (user_id) WHERE is_read = false
```

---

## 5. User Flow (актуальная версия)

```
[App Start]
     │
     ├── Есть токен + user? ──→ [Auth Guard] ──→ (tabs)
     │
     └── Нет токена ──→ [Login / Register]
                              │
                    [Register: 2 шага]
                    Шаг 1: email + password + name
                    Шаг 2: avatar_theme_id + experience_level + primary_goal
                              │
                    [POST /api/auth/register]
                    Ответ: access_token (15min) + refresh_token (7d)
                    Сохраняем оба в SecureStore
                              │
                    onboarding_done = false? ──→ [Onboarding: 3 слайда]
                    Слайд 1: "Log your workouts your way"
                    Слайд 2: "ML learns from your data" (активируется через 2 нед.)
                    Слайд 3: "Missions match your momentum"
                    CTA: "Start logging"
                              │
                    ──────────────────────────────────────────
                              │
                    [MAIN TABS]
                              │
             ┌────────────────┼────────────────────┐────────────────┐
             │                │                    │                │
       [LOG TAB]        [MAP TAB]          [MISSIONS TAB]    [STATS TAB]
             │
    [Workout Log]
    Показывает: активная миссия (strip) + streak
             │
    [+ Add Exercise] ──→ [ExerciseSearchModal]
                              │
              ┌───────────────┼───────────────────┐
              │               │                   │
        < 3 символа      ≥ 3 символа         Не найдено
        (локальный кэш)  (GET /api/exercises?q=)  │
                                          [Create Custom]
                                          POST /api/exercises
                              │
                    Выбрать упражнение ──→ [SetEntryPanel]
                    Ввести: sets / reps / weight_kg
                              │
                    [Add to session] ──→ возврат в Workout Log
                              │
    [Finish & Log Session]
    POST /api/workouts
    { workout_date, duration_minutes, notes, exercises[] }
             │
    [Gamification Service]
    - XP award = сумма по всем упражнениям
    - Проверка level up (XP threshold: 100 × 1.15^level)
    - Проверка достижений
    - Обновление streak
    - Прогресс активных миссий
             │
    ┌────────┴────────┐
    │                 │
 Level Up?     Mission Complete?
 Показать       Показать
 LevelUpModal   MissionCompleteModal
             │
    [Nightly ML Job] — APScheduler 00:00
    Условие: пользователь активен ≥ 14 дней И ≥ 3 сессий
    (иначе: cold start — beginner pool, статичные сообщения)
             │
    [Feature Engineering]
    - weekly_volume_delta: (vol_week_n - vol_week_n-1) / vol_week_n-1
    - session_frequency: sessions / 7 дней
    - load_progression: avg(weight_kg текущая неделя / предыдущая)
    - consistency_score: реальные дни / плановые дни
             │
    [LightGBM predict] ──→ trend: 'improving'|'plateau'|'declining'
             │
    [Write to ml_predictions]
    { trend, confidence, features_json, shap_values, model_version }
             │
    [Mission Adaptation]
    improving: target × 1.10..1.15 (hard pool)
    plateau:   target × 1.00       (current pool)
    declining: target × 0.75..0.85 (easy pool)
             │
    [Coach Message Generator]
    improving → 'encouraging' tone
    plateau   → 'neutral' tone
    declining → 'supportive' tone
    Write to coach_messages
             │
    [MAP TAB — Campaign]
    Показывает: прогресс кампании, текущий нод, развилка
    При развилке: выбор пути A/B
    PATCH /api/progress { campaign_path: 'A' | 'B' }
    Запись в user_progress.campaign_path
    Фильтрует mission_templates по campaign_path_filter

[LOGOUT]
POST /api/auth/logout { refresh_token }
Удаляет запись в user_sessions
clearAll() в SecureStore
```

---

## 6. API Endpoints (полный список)

### Auth
```
POST   /api/auth/register    — регистрация, возвращает токены + user
POST   /api/auth/login       — логин, возвращает токены + user
POST   /api/auth/refresh     — обновить access token по refresh token
POST   /api/auth/logout      — удалить сессию (принимает refresh_token в теле)
GET    /api/auth/me          — данные текущего юзера (требует Bearer)
```

### Exercises
```
GET    /api/exercises?q=&limit=   — fuzzy поиск (GIN index на name)
GET    /api/exercises/cache       — весь список для офлайн кэша мобилки
POST   /api/exercises             — создать кастомное упражнение
```

### Workouts
```
POST   /api/workouts              — создать тренировку (+ exercises[])
GET    /api/workouts?limit=&offset= — история тренировок юзера
GET    /api/workouts/:id          — детали тренировки
DELETE /api/workouts/:id          — удалить тренировку
```

### Gamification
```
GET    /api/progress              — user_progress (xp, level, streak, campaign state)
PATCH  /api/progress              — обновить campaign_path
GET    /api/missions              — активные миссии юзера
POST   /api/missions/:id/select   — выбрать миссию (создать user_mission)
GET    /api/campaigns             — все кампании
GET    /api/campaigns/:id/chapters — главы кампании
```

### ML / Coach
```
GET    /api/predictions/latest    — последний ml_prediction юзера
GET    /api/coach/messages        — непрочитанные сообщения коуча
PATCH  /api/coach/messages/:id    — отметить как прочитанное
```

### System
```
GET    /health                    — health check
```

---

## 7. Auth & Security

- **Access token:** JWT, 15 минут, stateless, не хранится в БД
- **Refresh token:** случайная строка (secrets.token_urlsafe(64)), SHA256 хеш хранится в `user_sessions`
- **Сам токен в БД не хранится** — только хеш. Проверка: hash(incoming) == stored_hash
- **Logout:** удаляет запись из `user_sessions`. Access token живёт до истечения (15 мин) — нет смысла его инвалидировать.
- **Мобилка:** токены в SecureStore (зашифрованное хранилище iOS/Android). Никогда AsyncStorage.
- **Axios interceptor:** при 401 автоматически вызывает `/api/auth/refresh`, повторяет исходный запрос. Если refresh тоже 401 — clearAll() + редирект на логин.

---

## 8. ML Pipeline (детально)

**Кто делает:** Багдат

**Когда запускается:** APScheduler, каждый день в 00:00 UTC

**Cold start условие:**
- Пользователь зарегистрирован < 14 дней ИЛИ у него < 3 тренировок
- В этом случае: `ml_predictions` не создаётся, миссии берутся из beginner pool, коуч пишет статичный onboarding текст

**Фичи модели (4 штуки):**
```python
features = {
    "weekly_volume_delta":  # (vol_this_week - vol_last_week) / vol_last_week
    "session_frequency":    # sessions_last_7_days / 7
    "load_progression":     # avg_weight_this_week / avg_weight_last_week
    "consistency_score":    # actual_training_days / planned_training_days
}
```

**Классы:** `improving` (0), `plateau` (1), `declining` (2)

**Масштабирование миссий:**
```
improving → adjusted_target = base_target × random(1.10, 1.15)  → hard pool
plateau   → adjusted_target = base_target × 1.00                → current pool
declining → adjusted_target = base_target × random(0.75, 0.85)  → easy pool
```

**Версионирование:** каждая запись в `ml_predictions` содержит `model_version` (формат: `lgbm_v1.0.0`). Критично для воспроизводимости диплома.

**SHAP values:** сохраняются в `ml_predictions.shap_values` как JSON — нужно для главы «Интерпретируемость ML» в дипломе.

---

## 9. Геймификация — логика

### XP и Уровни
```
XP за уровень N = floor(100 × 1.15^N)
Level 1: 115 XP
Level 2: 132 XP
Level 3: 152 XP
...
```

### Стадии (Avatar Stage)
| Стадия | Название | Тренировок |
|--------|----------|-----------|
| 0 | Rookie | < 6 |
| 1 | Active | 6–15 |
| 2 | Athlete | 16–30 |
| 3 | Champion | 31–50 |
| 4 | Legend | 51+ |

### Стрик
- `current_streak` увеличивается если тренировка была вчера или сегодня
- Обнуляется если пропуск > 1 дня
- `longest_streak` — исторический максимум

### Кампания
- Одна активная кампания у юзера
- `campaign_path` = 'A' или 'B' — выбирается на развилке в MAP экране
- `MISSION_TEMPLATES.campaign_path_filter`:
  - NULL → доступна всем
  - 'A' → только юзерам выбравшим путь A
  - 'B' → только юзерам выбравшим путь B

---

## 10. Офлайн работа (SQLite)

**Принцип:** mobile-first, offline-first.

SQLite на мобилке хранит:
- `workouts` — локальные тренировки (поле `synced = 0/1`)
- `workout_exercises` — упражнения тренировки
- `exercise_library_cache` — кэш упражнений для поиска без интернета

**Sync Worker (background):**
1. Находит записи где `synced = 0`
2. POST /api/workouts для каждой
3. При успехе: `synced = 1`, записывает server UUID
4. Конфликты: last `updated_at` wins

**Важно:** этот функционал в MVP частичный. Приоритет — онлайн тренировки с fallback на показ сохранённых.

---

## 11. Дизайн-система (Deep Crimson)

### Цветовая палитра
```typescript
// Surfaces (тёмные фоны)
void:  '#080809'
s1:    '#0F0F10'   // основной фон экранов
s2:    '#141415'   // карточки
s3:    '#1A1A1C'   // инпуты, строки упражнений
s4:    '#202022'   // иконки-боксы
s5:    '#282829'   // неактивные элементы

// Accent — единственный акцент (максимум 2-3 раза на экран)
cr:    '#C8343A'   // Deep Crimson
crLo:  'rgba(200,52,58,0.09)'
crMid: 'rgba(200,52,58,0.16)'
crBdr: 'rgba(200,52,58,0.28)'

// Bone white (важные числа, уровни)
bone:  '#E8E0D4'

// Текст
t1: '#E8E0D4'   // primary
t2: '#7A7570'   // secondary
t3: '#3E3C39'   // tertiary

// Semantic (тренд)
up:   '#6B9E6B'   // improving
flat: '#A89060'   // plateau
dn:   '#C8343A'   // declining (= accent)
```

### Шрифты
- **Outfit 900** — заголовки, display
- **Plus Jakarta Sans** — основной текст
- **JetBrains Mono** — числа, XP, stats, технические данные

### Правило акцента
`#C8343A` появляется **максимум 2-3 раза на экран**: CTA кнопка, активное состояние таба, критичная метрика. Везде остальное — near-black.

### Аватары (4 темы)
| ID | Name | Color |
|----|------|-------|
| 0 | Steel | #C8343A |
| 1 | Frost | #4A7FC1 |
| 2 | Forge | #B87C3A |
| 3 | Shadow | #7C5BB5 |

---

## 12. Что уже сделано (Фронт — статус на 12 марта 2026)

### ✅ Готово и работает

**Инфраструктура:**
- Expo SDK 54 проект настроен, запускается на iPhone через Expo Go
- expo-router v3, TypeScript, Zustand v4, Axios
- Шрифты подключены (Outfit + Plus Jakarta Sans + JetBrains Mono)
- `constants/theme.ts` — все цвета, шрифты, spacing в одном месте

**Auth:**
- `services/storage.ts` — SecureStore wrapper (access/refresh/user)
- `services/api.ts` — Axios instance + JWT auto-attach + refresh interceptor (очередь запросов при параллельных 401)
- `store/authStore.ts` — Zustand store: login, register, logout, init (восстановление сессии при старте)
- `app/(auth)/login.tsx` — экран логина, связан с бэкендом ✅
- `app/(auth)/register.tsx` — 2-шаговая регистрация (credentials → avatar + goals), связана с бэкендом ✅
- `app/_layout.tsx` — root layout, auth guard (редирект на login/tabs)

**Основные экраны (UI готов, данные mock):**
- `app/(tabs)/index.tsx` — Workout Log: добавление упражнений, active mission strip, summary, Finish & Log
- `app/(tabs)/campaign.tsx` — Campaign Map: нода с развилкой A/B, UI подтверждения
- `app/(tabs)/missions.tsx` — Missions: карточки с прогресс-баром, выбор до 2 миссий, AI coach card
- `app/(tabs)/stats.tsx` — Stats: уровень, стадия, streak, achievements, volume chart

**Компоненты:**
- `components/ui/Button.tsx` — варианты primary/ghost/dashed, loading state
- `components/ui/Input.tsx` — label, error, placeholder
- `components/ui/Card.tsx` — варианты default/crimson/bone
- `components/ui/ProgressBar.tsx` — с labels, кастомный цвет
- `components/workout/ExerciseSearchModal.tsx` — поиск (локальный < 3 символа / API ≥ 3), создание кастомного, SetEntryPanel (sets/reps/weight)
- `app/(tabs)/_layout.tsx` — кастомный bottom nav с SVG иконками

**Workout Store + API (Шаги 22–23, подключены к реальному API):**
- `store/workoutStore.ts` — Zustand: addExercise, removeExercise, updateExercise, submitWorkout (POST /api/workouts), selectTotalReps, selectTotalVolume helpers
- `services/workoutApi.ts` — exerciseApi.search(q, limit), exerciseApi.create(name, muscle_group), exerciseApi.getAll(), workoutApi.createWorkout(payload), workoutApi.getHistory(limit, offset), workoutApi.getById(id), workoutApi.delete(id)
- `app/(tabs)/index.tsx` — Workout Log подключён к workoutStore: реальный submit, статусы Saving→Saved→reset, error banner
- `components/workout/ExerciseSearchModal.tsx` — умный поиск: < 3 символов → локальный список (офлайн), ≥ 3 символов → GET /api/exercises?q= с debounce 350ms + fallback на локальный при ошибке сети; Create Custom → POST /api/exercises

**Payload формат POST /api/workouts:**
```json
{
  "workout_date": "2026-03-12",
  "duration_minutes": 45,
  "notes": null,
  "exercises": [
    { "exercise_id": "uuid", "sets": 3, "reps": 10, "weight_kg": 80.0, "order_index": 0 }
  ]
}
```

### ⏳ Ещё не сделано (frontend)

- `app/(onboarding)/` — 3 слайда онбординга (Шаг 24)
- `app/(tabs)/profile.tsx` — профиль + logout кнопка (Шаг 25)
- Подключение реальных данных в `campaign.tsx` (сейчас mock nodes)
- Подключение реальных данных в `missions.tsx` (сейчас mock missions)
- Подключение реальных данных в `stats.tsx` (сейчас mock stats)
- `store/gameStore.ts` — missions, campaigns, progress state
- SQLite офлайн кэш (опциональный для MVP)
- LevelUpModal, MissionCompleteModal (анимированные попапы)
- CoachMessages inbox экран

---

## 13. Что нужно от бэкенда прямо сейчас

Фронт ждёт следующих endpoint (в порядке приоритета):

### Приоритет 1 — уже пишет запросы, нужны немедленно
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```
**Статус:** реализованы в `backend/app/api/auth.py` ✅

```
POST /api/workouts
GET  /api/exercises?q=&limit=
POST /api/exercises
GET  /api/exercises/cache
```
**Статус:** нужна реализация ⏳

### Приоритет 2 — нужны для подключения реальных данных в табах
```
GET  /api/progress
PATCH /api/progress
GET  /api/missions
POST /api/missions/:id/select
GET  /api/campaigns
GET  /api/campaigns/:id/chapters
```

### Приоритет 3 — ML (Багдат)
```
GET  /api/predictions/latest
GET  /api/coach/messages
PATCH /api/coach/messages/:id
```

---

## 14. Роадмап (7 фаз)

| Фаза | Что | Дней | Кто |
|------|-----|------|-----|
| ✅ 1 | Инфраструктура: монорепо, FastAPI, PostgreSQL, Alembic, Expo | 1–2 | Все |
| ✅ 2 | Auth: register/login/refresh/logout/me + мобильные экраны | 2–3 | Фронт + Бэк |
| 🔄 3 | Exercises + Workout CRUD: seed, search, POST workout | 3–4 | Фронт + Бэк |
| ⏳ 4 | Gamification basic: seed missions/campaigns, XP, mission endpoints | 2–3 | Бэк |
| ⏳ 5 | ML Pipeline: features, train, predict, APScheduler, coach | 3–4 | Багдат |
| ⏳ 6 | Оставшиеся экраны: onboarding, profile, workout history, coach inbox | 1–2 | Фронт |
| ⏳ 7 | Polish + Testing: ML accuracy ≥70%, sync testing, deploy, APK build | 3–4 | Все |

**MVP target: 31 марта 2026**

---

## 15. Настройка бэкенда с нуля

```bash
# 1. Клонировать репо и перейти в backend
cd orleu/backend

# 2. Создать виртуальное окружение
python -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows

# 3. Установить зависимости
pip install -r requirements.txt

# 4. Настроить .env
cp .env.example .env
# Отредактировать: DATABASE_URL, SECRET_KEY

# 5. Создать БД в PostgreSQL
# psql: CREATE DATABASE orleu_db;

# 6. Запустить миграции
alembic revision --autogenerate -m "initial schema"
alembic upgrade head

# 7. Запустить сервер
uvicorn app.main:app --reload --port 8000

# Swagger UI: http://localhost:8000/docs
```

### .env (обязательные переменные)
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/orleu_db
SECRET_KEY=минимум-32-символа-случайная-строка
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
APP_ENV=development
```

---

## 16. Ключевые архитектурные решения

| Решение | Почему |
|---------|--------|
| SQLite + PostgreSQL (dual DB) | Офлайн-first на мобилке, PostgreSQL source of truth |
| Refresh token хранится как SHA256 хеш | Безопасность — даже при утечке БД токен не компрометирован |
| `total_volume` не хранится | Вычисляется: `sets × reps × weight_kg` — нет дублирования данных |
| ML запускается ночью (APScheduler) | Не блокирует UI, батчевая обработка всех юзеров |
| Cold start 14 дней / 3 сессии | Недостаточно данных для качественного предикта LightGBM |
| `model_version` в каждом prediction | Воспроизводимость для диплома (можно перекатить модель) |
| `campaign_path_filter` в mission_templates | Разные пути → разные пулы миссий, без дублирования таблиц |
| Регистрация собирает только experience + goal | Нет биометрики — приложение про силу/объём, не калории |

---

## 17. Контакты и ресурсы

- **Репо:** (добавить ссылку на GitHub)
- **Фронт-разработчик:** ведёт этот чат
- **Бэкенд-разработчик:** ты
- **ML (Фаза 5):** Багдат
- **Swagger (dev):** http://localhost:8000/docs
- **Expo:** `npx expo start --lan` (iPhone + ноутбук в одной WiFi)
