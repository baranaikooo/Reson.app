import numpy as np

def calculate_discount(avg_rt, t_min=2.0, hesitated=False):
    """
    Calculates the quality discount multiplier for a user based on response time.
    If avg_rt >= t_min, discount is 1.0 (no penalty).
    If avg_rt < t_min, discount is scaled proportionally: avg_rt / t_min.
    If hesitated is True, applies an extra 30% gyroscopic hesitation penalty.
    
    Inputs can be scalars, numpy arrays, or pandas Series.
    Returns a discount multiplier in the range [0.1, 1.0].
    """
    avg_rt = np.array(avg_rt, dtype=float)
    hesitated = np.array(hesitated, dtype=bool)
    
    # Scale down discount factor if below t_min
    discount = np.where(
        avg_rt >= t_min,
        1.0,
        avg_rt / t_min
    )
    
    # Apply 30% gyroscopic hesitation penalty
    discount = np.where(hesitated, discount * 0.7, discount)
    
    # Clip to ensure minimum discount is 0.1 (prevents absolute zero out,
    # but applies up to a 90% penalty for bots/click-cheaters).
    return np.clip(discount, 0.1, 1.0)

def get_calibration_multiplier(rt_p, rt_q, t_min=2.0, hesitated_p=False, hesitated_q=False):
    """
    Calculates the combined calibration multiplier for two users.
    Supports scalars, numpy arrays, or pandas Series.
    """
    return calculate_discount(rt_p, t_min, hesitated_p) * calculate_discount(rt_q, t_min, hesitated_q)
