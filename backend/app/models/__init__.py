# app/models/__init__.py

# Импортируем все модели сюда, чтобы они зарегистрировались в Base.metadata
from .auth import User, UserSession
from .workout import ExerciseLibrary, Workout, WorkoutExercise
from .gamification import (
    Campaign, 
    CampaignChapter, 
    UserProgress, 
    MissionTemplate, 
    UserMission, 
    SkillTreeNode, 
    UserSkillTree, 
    Achievement, 
    UserAchievement
)
from .ml import MlPrediction, CoachMessage

# Можно (опционально) определить __all__ для явного экспорта
__all__ = [
    "User", "UserSession",
    "ExerciseLibrary", "Workout", "WorkoutExercise",
    "Campaign", "CampaignChapter", "UserProgress", "MissionTemplate", 
    "UserMission", "SkillTreeNode", "UserSkillTree", "Achievement", "UserAchievement",
    "MlPrediction", "CoachMessage"
]