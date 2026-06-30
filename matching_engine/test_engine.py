import pytest
import numpy as np
import pandas as pd
from matching_engine.scoring import calculate_similarity, calculate_complementarity
from matching_engine.penalties import get_toxicity_multiplier
from matching_engine.calibration import calculate_discount, get_calibration_multiplier
from matching_engine.engine import calculate_pair_score, find_matches_for_user

def test_similarity():
    # Perfect match (distance = 0)
    assert calculate_similarity(0.5, 0.5, 0.8, 0.8) == 1.0
    
    # Worst case match [0, 0] vs [1, 1] (distance = sqrt(2)) -> similarity = 0.0
    assert abs(calculate_similarity(0.0, 1.0, 0.0, 1.0) - 0.0) < 1e-9
    
    # Vectorized similarity check
    sims = calculate_similarity([0.5, 0.0], [0.5, 1.0], [0.8, 0.0], [0.8, 1.0])
    assert np.allclose(sims, [1.0, 0.0])

def test_asymmetric_complementarity():
    # Perfect complementarity (sum is exactly 1.0)
    assert calculate_complementarity(0.5, 0.5) == 1.0
    assert calculate_complementarity(0.2, 0.8) == 1.0
    
    # Under-target (two introverts: 0.1 + 0.1 = 0.2)
    # distance is 0.5 * (1.0 - 0.2) = 0.4. Score is 0.6.
    introvert_score = calculate_complementarity(0.1, 0.1)
    assert abs(introvert_score - 0.6) < 1e-9
    
    # Over-target (two extroverts: 0.9 + 0.9 = 1.8)
    # distance is 1.0 * (1.8 - 1.0) = 0.8. Score is 0.2.
    extrovert_score = calculate_complementarity(0.9, 0.9)
    assert abs(extrovert_score - 0.2) < 1e-9
    
    # Assert two introverts are penalized LESS than two extroverts (asymmetry check)
    assert introvert_score > extrovert_score

def test_toxicity_penalties():
    # Secure + Secure has 1.0 multiplier (0% penalty)
    assert get_toxicity_multiplier("Secure", "Secure") == 1.0
    
    # Anxious + Avoidant should be a hard veto (0.0 multiplier)
    assert get_toxicity_multiplier("Anxious", "Avoidant") == 0.0
    assert get_toxicity_multiplier("Avoidant", "Anxious") == 0.0
    
    # Secure + Avoidant should be minor/moderate penalty
    assert 0.0 < get_toxicity_multiplier("Secure", "Avoidant") < 1.0
    
    # Vectorized check
    styles_p = ["Secure", "Anxious", "Avoidant"]
    styles_q = ["Secure", "Avoidant", "Anxious"]
    multipliers = get_toxicity_multiplier(styles_p, styles_q)
    assert np.allclose(multipliers, [1.0, 0.0, 0.0])

def test_anti_cheat_calibration():
    # Fast clicks (below 2.0s minimum threshold)
    assert calculate_discount(1.0, t_min=2.0) == 0.5
    assert calculate_discount(0.1, t_min=2.0) == 0.1  # Clipped at 0.1 minimum
    
    # Normal response times
    assert calculate_discount(2.5, t_min=2.0) == 1.0
    
    # Vectorized check
    rts = np.array([0.5, 2.0, 3.0])
    discounts = calculate_discount(rts, t_min=2.0)
    assert np.allclose(discounts, [0.25, 1.0, 1.0])

def test_matchmaker_orchestrator():
    data = {
        "id": [1, 2, 3, 4],
        "name": ["Alice", "Bob", "Charlie", "David"],
        "cognitive_depth": [0.8, 0.8, 0.2, 0.7],
        "conscientiousness": [0.9, 0.9, 0.3, 0.6],
        "extraversion": [0.1, 0.9, 0.1, 0.5],
        "attachment_style": ["Secure", "Secure", "Anxious", "Avoidant"],
        "avg_response_time": [2.5, 3.0, 1.0, 2.2],  # Charlie is speed-clicking
        "hesitated": [False, False, False, False],
        "redemption_quota": [0, 0, 0, 0]
    }
    df = pd.DataFrame(data)
    
    # Find matches for Alice (ID 1)
    matches = find_matches_for_user(1, df)
    
    assert len(matches) == 3
    assert matches.iloc[0]["name"] == "Bob"  # Bob is a great match (high similarity, secure, good RT)
    assert "match_score" in matches.columns
    
    # Verify David is scored
    david_match = matches[matches["name"] == "David"].iloc[0]
    assert 0.0 < david_match["match_score"] < 1.0

def test_redemption_penalty():
    from matching_engine.penalties import get_redemption_multiplier
    # If redemption quota is > 0, 50% discount must be returned
    assert get_redemption_multiplier(3) == 0.5
    assert get_redemption_multiplier(1) == 0.5
    # If redemption quota is 0, normal 1.0 multiplier is returned
    assert get_redemption_multiplier(0) == 1.0
    
    # Vectorized check
    quotas = np.array([3, 0, 1])
    multipliers = get_redemption_multiplier(quotas)
    assert np.allclose(multipliers, [0.5, 1.0, 0.5])
