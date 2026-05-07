# backend/test_predict.py
import sys
sys.path.insert(0, ".")
import warnings
warnings.filterwarnings("ignore")

from ml.predict import predict_trend
from unittest.mock import patch

# Симулируем improving пользователя
improving_features = {
    "weekly_volume_delta":   0.20,
    "session_frequency":     0.70,
    "load_progression":      1.15,
    "consistency_score":     0.75,
    "nutrition_consistency": 0.60,
}

# Симулируем declining пользователя  
declining_features = {
    "weekly_volume_delta":   -0.30,
    "session_frequency":     0.15,
    "load_progression":      0.85,
    "consistency_score":     0.10,
    "nutrition_consistency": 0.05,
}

import uuid
from unittest.mock import MagicMock

for label, features in [("IMPROVING", improving_features), ("DECLINING", declining_features)]:
    with patch("ml.predict.build_features", return_value=features):
        result = predict_trend(uuid.uuid4(), MagicMock())
    
    print(f"\n--- {label} user ---")
    print(f"  trend:      {result['trend']}")
    print(f"  confidence: {result['confidence']:.2%}")
    print(f"  top SHAP:   ", end="")
    top = sorted(result['shap_values'].items(), key=lambda x: abs(x[1]), reverse=True)[0]
    print(f"{top[0]} = {top[1]:+.3f}")
    
    # Проверка
    expected = label.lower()
    ok = result['trend'] == expected
    print(f"  [{'PASS' if ok else 'FAIL'}] expected {expected}, got {result['trend']}")