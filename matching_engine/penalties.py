import numpy as np

# Penalty matrix for attachment styles.
# Values represent the Expected Value (EV) penalties (negative values).
# A penalty of -1.0 represents a hard veto (resulting multiplier is 0.0).
PENALTY_MATRIX = {
    "Secure": {
        "Secure": 0.0,
        "Anxious": -0.15,
        "Avoidant": -0.20,
        "Fearful": -0.25
    },
    "Anxious": {
        "Secure": -0.15,
        "Anxious": -0.40,
        "Avoidant": -1.00,  # Hard negative block (veto)
        "Fearful": -0.60
    },
    "Avoidant": {
        "Secure": -0.20,
        "Anxious": -1.00,  # Hard negative block (veto)
        "Avoidant": -0.50,
        "Fearful": -0.60
    },
    "Fearful": {
        "Secure": -0.25,
        "Anxious": -0.60,
        "Avoidant": -0.60,
        "Fearful": -0.70
    }
}

def get_toxicity_multiplier(style_p, style_q, coop_count=0, avoidant_bias_p=0.0, avoidant_bias_q=0.0):
    """
    Calculates the toxicity multiplier for two attachment styles.
    Supports single strings, numpy arrays, or pandas Series.
    Returns a multiplier in the range [0.0, 1.0].
    
    If coop_count >= 100, the toxicity penalty is softened by 25%.
    """
    def _single_penalty(sp, sq, count, bias_p, bias_q):
        # Normalize inputs
        sp_norm = str(sp).strip().capitalize()
        sq_norm = str(sq).strip().capitalize()
        
        # Fallback to Secure if the style is unrecognized
        if sp_norm not in PENALTY_MATRIX:
            sp_norm = "Secure"
        if sq_norm not in PENALTY_MATRIX:
            sq_norm = "Secure"
            
        penalty = PENALTY_MATRIX[sp_norm].get(sq_norm, 0.0)
        
        # Amplified avoidant toxicity penalty if either side has avoidant bias from ghosting
        if sp_norm == "Anxious" and sq_norm == "Avoidant":
            penalty = penalty - (float(bias_q) * 0.4)
        elif sp_norm == "Avoidant" and sq_norm == "Anxious":
            penalty = penalty - (float(bias_p) * 0.4)
        
        # Soften penalty by 25% if we have at least 100 successful cooperations (avoid overfitting)
        if count >= 100:
            penalty = penalty * 0.75
            
        return penalty

    # Vectorize for arrays/Series support
    vectorized_penalty = np.vectorize(_single_penalty)
    penalties = vectorized_penalty(style_p, style_q, coop_count, avoidant_bias_p, avoidant_bias_q)
    
    # Multiplier is (1.0 + penalty). Clip to keep in [0.0, 1.0].
    return np.clip(1.0 + penalties, 0.0, 1.0)

def get_redemption_multiplier(redemption_quota):
    """
    Returns 0.5 (50% penalty) if redemption_quota > 0, else 1.0 (no penalty).
    Supports scalars, numpy arrays, or pandas Series.
    """
    # Convert input to numpy array to support vectorized operations
    quota = np.array(redemption_quota)
    return np.where(quota > 0, 0.5, 1.0)

def get_ghosting_multiplier(ghosting_count):
    """
    Returns a multiplier based on the number of active ghosting records.
    0 ghostings: 1.0 (no penalty)
    1 ghosting: 0.70 (30% penalty)
    2+ ghostings: 0.40 (60% penalty)
    """
    count = np.array(ghosting_count)
    return np.where(count == 0, 1.0, np.where(count == 1, 0.70, 0.40))


