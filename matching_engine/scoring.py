import numpy as np

def calculate_similarity(depth_p, depth_q, cons_p, cons_q):
    """
    Calculates similarity score based on Cognitive Depth and Conscientiousness.
    Inputs can be scalars or numpy arrays/pandas Series in the range [0, 1].
    Returns normalized similarity score in the range [0, 1].
    """
    depth_p = np.array(depth_p, dtype=float)
    depth_q = np.array(depth_q, dtype=float)
    cons_p = np.array(cons_p, dtype=float)
    cons_q = np.array(cons_q, dtype=float)
    
    # Calculate Euclidean distance
    dist = np.sqrt((depth_p - depth_q) ** 2 + (cons_p - cons_q) ** 2)
    
    # Max possible distance in 2D space of size [0, 1]^2 is sqrt(2)
    max_dist = np.sqrt(2.0)
    
    return 1.0 - (dist / max_dist)

def calculate_complementarity(ext_p, ext_q, target=1.0):
    """
    Calculates complementarity score for Extraversion.
    Uses an asymmetric penalty function where two introverts (sum < target)
    are penalized less harshly than two extroverts (sum > target).
    
    Inputs can be scalars or numpy arrays/pandas Series in the range [0, 1].
    Returns complementarity score in the range [0, 1].
    """
    ext_p = np.array(ext_p, dtype=float)
    ext_q = np.array(ext_q, dtype=float)
    
    combined_sum = ext_p + ext_q
    
    # Asymmetric distance:
    # Under-target (introvert-introvert) is penalized with a 0.5 multiplier.
    # Over-target (extrovert-extrovert) is penalized with a 1.0 multiplier.
    dist = np.where(
        combined_sum < target,
        0.5 * (target - combined_sum),
        1.0 * (combined_sum - target)
    )
    
    # Clip to [0, 1] range to avoid negative scores
    dist = np.clip(dist, 0.0, 1.0)
    
    return 1.0 - dist
