import pandas as pd
import numpy as np
from matching_engine.scoring import calculate_similarity, calculate_complementarity
from matching_engine.penalties import get_toxicity_multiplier, get_redemption_multiplier, get_ghosting_multiplier
from matching_engine.calibration import get_calibration_multiplier

def calculate_pair_score(
    depth_p, depth_q,
    cons_p, cons_q,
    ext_p, ext_q,
    style_p, style_q,
    rt_p, rt_q,
    w_sim=0.6,
    w_comp=0.4,
    t_min=2.0,
    target=1.0,
    hesitated_p=False,
    hesitated_q=False,
    redemption_quota_p=0,
    redemption_quota_q=0,
    avoidant_bias_p=0.0,
    avoidant_bias_q=0.0,
    ghosting_count_p=0,
    ghosting_count_q=0
):
    """
    Calculates the final matching score for two users.
    Supports both scalar values and NumPy arrays/Pandas Series for vectorized computation.
    
    Args:
        depth_p, depth_q: Cognitive depth scores [0, 1]
        cons_p, cons_q: Conscientiousness scores [0, 1]
        ext_p, ext_q: Extraversion scores [0, 1]
        style_p, style_q: Attachment style names (strings)
        rt_p, rt_q: Average response times in seconds
        w_sim: Weight of the similarity vector (default 0.6)
        w_comp: Weight of the complementarity vector (default 0.4)
        t_min: Minimum threshold for response times (default 2.0s)
        target: Target sum for extraversion complementarity (default 1.0)
        hesitated_p, hesitated_q: Gyroscopic hesitation flags (default False)
        
    Returns:
        Final match score in the range [0.0, 1.0].
    """
    # 1. Similarity (Euclidean distance minimization)
    s_sim = calculate_similarity(depth_p, depth_q, cons_p, cons_q)
    
    # 2. Complementarity (Target combined sum optimization with asymmetric introvert discount)
    s_comp = calculate_complementarity(ext_p, ext_q, target=target)
    
    # 3. Asymmetric EV Toxicity penalties (including avoidant bias from ghosting)
    m_tox = get_toxicity_multiplier(style_p, style_q, avoidant_bias_p=avoidant_bias_p, avoidant_bias_q=avoidant_bias_q)
    
    # 4. Anti-cheat response calibration (with gyroscopic hesitation)
    m_cheat = get_calibration_multiplier(rt_p, rt_q, t_min=t_min, hesitated_p=hesitated_p, hesitated_q=hesitated_q)
    
    # 5. Combined Score (with dynamic redemption quota penalty - 50% discount if quota > 0, and ghosting penalties)
    m_red_p = get_redemption_multiplier(redemption_quota_p)
    m_red_q = get_redemption_multiplier(redemption_quota_q)
    m_ghost_p = get_ghosting_multiplier(ghosting_count_p)
    m_ghost_q = get_ghosting_multiplier(ghosting_count_q)
    
    base_score = (w_sim * s_sim) + (w_comp * s_comp)
    final_score = base_score * m_tox * m_cheat * m_red_p * m_red_q * m_ghost_p * m_ghost_q
    
    return final_score

def find_matches_for_user(user_id, df, w_sim=0.6, w_comp=0.4, t_min=2.0):
    """
    Vectorized computation of matches for a target user ID against all other candidates in df.
    """
    if user_id not in df['id'].values:
        raise ValueError(f"User ID '{user_id}' not found in the dataset.")
        
    # Isolate target user and candidates
    target_user = df[df['id'] == user_id].iloc[0]
    candidates = df[df['id'] != user_id].copy()
    
    if candidates.empty:
        candidates['match_score'] = []
        return candidates
        
    # Calculate dynamic target extraversion: clamp(mean(candidates extraversion) * 2.0, 0.6, 1.4)
    avg_candidate_e = np.mean(candidates['extraversion'].values)
    dynamic_target = np.clip(avg_candidate_e * 2.0, 0.6, 1.4)
    
    # Gyroscopic hesitation, redemption, avoidant bias, and ghosting indicators
    hesitated_p = bool(target_user.get('hesitated', False))
    hesitated_q = candidates['hesitated'].values if 'hesitated' in candidates.columns else False
    
    red_quota_p = int(target_user.get('redemption_quota', 0))
    red_quota_q = candidates['redemption_quota'].values if 'redemption_quota' in candidates.columns else 0
    
    av_bias_p = float(target_user.get('avoidant_bias', 0.0))
    av_bias_q = candidates['avoidant_bias'].values if 'avoidant_bias' in candidates.columns else 0.0
    
    ghost_p = int(target_user.get('ghosting_count', 0))
    ghost_q = candidates['ghosting_count'].values if 'ghosting_count' in candidates.columns else 0
        
    # Run vectorized calculation
    scores = calculate_pair_score(
        depth_p=target_user['cognitive_depth'],
        depth_q=candidates['cognitive_depth'].values,
        cons_p=target_user['conscientiousness'],
        cons_q=candidates['conscientiousness'].values,
        ext_p=target_user['extraversion'],
        ext_q=candidates['extraversion'].values,
        style_p=target_user['attachment_style'],
        style_q=candidates['attachment_style'].values,
        rt_p=target_user['avg_response_time'],
        rt_q=candidates['avg_response_time'].values,
        w_sim=w_sim,
        w_comp=w_comp,
        t_min=t_min,
        target=dynamic_target,
        hesitated_p=hesitated_p,
        hesitated_q=hesitated_q,
        redemption_quota_p=red_quota_p,
        redemption_quota_q=red_quota_q,
        avoidant_bias_p=av_bias_p,
        avoidant_bias_q=av_bias_q,
        ghosting_count_p=ghost_p,
        ghosting_count_q=ghost_q
    )
    
    candidates['match_score'] = scores
    return candidates.sort_values(by='match_score', ascending=False)
