<div align="center">

# 🏋️ Orleu

### Adaptive · Gamified · Gym Tracking

**Orleu** turns your training journey into an RPG. Log your workouts, complete missions, advance through story campaigns, and earn XP — while a machine-learning model quietly studies your progress every night and adapts the challenge to keep you in the zone.

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo_SDK_54-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![LightGBM](https://img.shields.io/badge/ML-LightGBM-9cf)](https://lightgbm.readthedocs.io/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)

*A diploma project at Astana IT University*

</div>

---

## ✨ What makes Orleu different

Most fitness apps give everyone the same static plan. Orleu **adapts to you**.

A **LightGBM** model runs every night, analyzes your recent training, and classifies your trend as **Improving 📈**, **Plateau ➖**, or **Declining 📉**. That single signal ripples through the whole experience:

| Trend | Mission difficulty | Campaign | AI Coach tone |
|-------|-------------------|----------|---------------|
| 📈 Improving | Scales up | Branches forward | Celebratory, pushes harder |
| ➖ Plateau | Holds steady | Mixes it up | Strategic, suggests variation |
| 📉 Declining | Eases off | Recovery arc | Supportive, focuses on consistency |

**SHAP** values explain *why* the model decided what it did — so the coach can give grounded, personal advice instead of generic motivation.

---

## 🎮 Features

- **🗺️ Story Campaigns** — progress through a gamified campaign map, with branches that react to your performance
- **🎯 Daily & Weekly Missions** — auto-assigned, difficulty-scaled to your level, experience, and goals; reset every Monday
- **🏆 Achievements** — collectible badges with rarity tiers
- **⚡ XP & Leveling** — every logged set moves you forward
- **🔥 Streaks** — consistency tracking that the ML model rewards
- **🤖 AI Coach** — dynamic, context-aware messages (powered by OpenRouter LLMs, with template fallback)
- **🍎 Nutrition Tracking** — log food, set macro goals
- **📊 Stats & Personal Records** — visualize progress and track PRs
- **🧭 Onboarding** — a 6-slide animated flow that captures goals & experience to seed your plan

---

## 🏛️ Architecture

```
┌──────────────────────────┐         ┌────────────────────────────────────┐
│   📱 Mobile (Expo / RN)   │  HTTPS  │        🚀 Backend (FastAPI)         │
│                          │ ──────► │                                    │
│  • expo-router screens   │  REST   │  /api/auth      /api/missions      │
│  • Zustand stores        │         │  /api/workouts  /api/campaigns     │
│  • SQLite offline cache  │ ◄────── │  /api/coach     /api/achievements  │
└──────────────────────────┘  JSON   │  /api/nutrition /api/prs    ...    │
                                      └──────────────┬─────────────────────┘
                                                     │
                          ┌──────────────────────────┼──────────────────────────┐
                          │                           │                          │
                  ┌───────▼────────┐        ┌─────────▼─────────┐      ┌──────────▼─────────┐
                  │ 🐘 PostgreSQL   │        │ 🌙 APScheduler     │      │ 🧠 ML Pipeline      │
                  │  (SQLAlchemy   │        │  • nightly ML      │      │  LightGBM + SHAP   │
                  │   + Alembic)   │        │  • mission expiry  │ ───► │  trend classifier  │
                  │                │        │  • weekly reset    │      │  (model.pkl)       │
                  └────────────────┘        └────────────────────┘      └────────────────────┘
```

📐 Detailed UML & BPMN diagrams live in [docs/diagrams/](docs/diagrams/) (architecture, use cases, sequence & activity flows).

---

## 🧰 Tech Stack

**Backend**
- FastAPI · Uvicorn
- SQLAlchemy 2.0 · Alembic migrations · PostgreSQL
- LightGBM · scikit-learn · SHAP · pandas / numpy
- APScheduler (nightly jobs)
- python-jose + passlib (JWT auth)
- OpenRouter (LLM coach) · Sentry (error tracking)

**Mobile**
- React Native 0.81 · Expo SDK 54 · expo-router
- Zustand (state) · Axios (API)
- expo-sqlite (offline cache) · expo-secure-store (tokens)
- react-native-svg · expo-haptics · Sentry

---

## 🚀 Getting Started

### Backend

```bash
cd backend

# create & activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows (git bash): source venv/Scripts/activate

# install dependencies
pip install --no-cache-dir -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/orleu
SECRET_KEY=change-me

# optional
OPENROUTER_API_KEY=
ADMIN_USERNAME=
ADMIN_PASSWORD=
SENTRY_DSN=
```

Run migrations, seed data, and start the server:

```bash
alembic upgrade head

# (optional) seed reference data
python -m app.seed_exercises
python -m app.seed_campaigns
python -m app.seed_mission_templates
python -m app.seed_achievements
python -m app.seed_food_items

uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

📖 Interactive API docs: **http://localhost:8080/docs**

### Mobile

```bash
cd mobilee
npm install
```

Point the app at your backend — set the base URL in [mobilee/services/api.ts](mobilee/services/api.ts) to your machine's LAN IP (find it with `ipconfig` / `ifconfig`), e.g. `http://192.168.0.42:8080`.

```bash
npm start          # then scan the QR code with Expo Go
# or
npm run android
npm run ios
```

> ⚠️ Don't modify `package.json` versions — the Expo SDK pins are intentional.

---

## 🧠 ML Pipeline

The trend classifier turns five engineered features into a training trend:

```
weekly_volume_delta · session_frequency · load_progression
       · consistency_score · nutrition_consistency
                          │
                          ▼
              🌳 LightGBM classifier
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
       improving       plateau      declining
            └──────── SHAP explains why ───────┘
```

```bash
cd backend

# train (regenerates ml/model.pkl)
python -m ml.train

# end-to-end test
python test_ml_e2e.py
```

In production the model runs automatically at **00:00 UTC** via APScheduler ([app/tasks/nightly_ml.py](backend/app/tasks/nightly_ml.py)) and writes predictions used to scale missions, branch campaigns, and tone the coach.

---

## 📁 Project Structure

```
orleu/
├── backend/
│   ├── app/
│   │   ├── api/          # route handlers (auth, workouts, missions, coach…)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # business logic (gamification, coach, llm)
│   │   ├── tasks/        # scheduled jobs (nightly ML, mission reset/expiry)
│   │   ├── config.py     # settings
│   │   └── main.py       # app entrypoint + scheduler
│   ├── ml/               # features, train, predict, model.pkl
│   ├── alembic/          # database migrations
│   └── tests/
├── mobilee/
│   ├── app/              # expo-router screens (auth, tabs, workout…)
│   ├── components/       # reusable UI
│   ├── services/         # API client
│   ├── store/            # Zustand stores
│   └── constants/        # theme & config
└── docs/diagrams/        # UML + BPMN
```

---

## 🗺️ Roadmap

- [x] **Phase 1** — Infrastructure
- [x] **Phase 2** — Authentication
- [x] **Phase 3** — Exercises + Workouts CRUD
- [x] **Phase 4** — Gamification (campaigns, missions, XP)
- [x] **Phase 5** — ML pipeline (features, train, predict, scheduler, coach)
- [x] **Phase 6** — Remaining screens (onboarding, profile, coach inbox)
- [ ] **Phase 7** — Polish & testing (ML accuracy ≥ 70%, sync, deploy, APK)

---

## 👥 Team

| Member | Role |
|--------|------|
| **Nurmukhammed Kanafin** | Backend |
| **Adilet** | Machine Learning |
| **Baglan** | Mobile Developer |

🎓 Diploma project — **Astana IT University** · MVP: March 2026 · Final defense: May 2026

---

<div align="center">

*Built with FastAPI, React Native, and a model that never skips leg day.*

</div>
