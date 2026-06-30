import os
from collections import Counter
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from supabase import create_client, Client

# Import the psychometric engine functions
from matching_engine.scoring import calculate_similarity, calculate_complementarity
from matching_engine.penalties import get_toxicity_multiplier, get_redemption_multiplier, get_ghosting_multiplier
from matching_engine.calibration import get_calibration_multiplier

# Initialize FastAPI App
app = FastAPI(
    title="Reson EV Matchmaking API",
    description="Python FastAPI backend serving psychometric Expected Value matchmaking calculation.",
    version="1.0.0"
)

# Initialize Supabase Admin/Service Client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("[supabase] Admin client connected successfully.")
    except Exception as e:
        print(f"[supabase] Connection error: {e}")
else:
    print("[supabase] Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in environment.")

# --- Schemas ---

class ProfileSubmit(BaseModel):
    user_id: UUID
    name: str
    age: int
    city: str
    gender: str
    orientation: str
    cognitive_depth: float
    conscientiousness: float
    extraversion: float
    attachment_style: str
    avg_response_time: float
    top_priority: str
    hesitated: Optional[bool] = False
    redemption_quota: Optional[int] = 0
    avoidant_bias: Optional[float] = 0.0
    ghosting_count: Optional[int] = 0

class MatchResponse(BaseModel):
    id: UUID
    name: str
    age: int
    city: str
    img: Optional[str] = None
    ev_score: float
    similarity_pct: float
    complementarity_label: str
    attachment_safety: str

class VoiceMessageSend(BaseModel):
    match_id: UUID
    sender_id: UUID
    media_url: str
    duration: float

class VoteSubmit(BaseModel):
    match_id: UUID
    user_id: UUID
    vote: str # 'unlock' | 'cancel'

class PressureSubmit(BaseModel):
    match_id: UUID
    user_id: UUID
    scenario_id: str
    style: str # 'Avoidant' | 'Anxious' | 'Secure'
    response_time: float
    hesitated: bool

# --- Endpoints ---

@app.post("/api/profile/submit", status_code=status.HTTP_201_CREATED)
async def submit_profile(profile: ProfileSubmit):
    """
    Saves or updates a user profile, formats their similarity vector
    [cognitive_depth, conscientiousness] and writes to profiles table.
    """
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase connection not initialized on backend."
        )

    # Format vector as string array: '[0.5, 0.6]'
    similarity_vector = [profile.cognitive_depth, profile.conscientiousness]
    
    payload = {
        "id": str(profile.user_id),
        "name": profile.name,
        "age": profile.age,
        "city": profile.city,
        "gender": profile.gender,
        "orientation": profile.orientation,
        "cognitive_depth": profile.cognitive_depth,
        "conscientiousness": profile.conscientiousness,
        "extraversion": profile.extraversion,
        "attachment_style": profile.attachment_style,
        "avg_response_time": profile.avg_response_time,
        "top_priority": profile.top_priority,
        "hesitated": profile.hesitated,
        "redemption_quota": profile.redemption_quota,
        "avoidant_bias": profile.avoidant_bias,
        "ghosting_count": profile.ghosting_count,
        "similarity_vector": similarity_vector
    }

    try:
        res = supabase_client.table("profiles").upsert(payload).execute()
        return {"status": "ok", "message": "Profile updated successfully.", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database update failed: {e}")

@app.get("/api/matches/daily/{user_id}", response_model=List[MatchResponse])
async def get_daily_matches(user_id: UUID):
    """
    Finds nearest neighbors by similarity vector, filters candidates,
    calculates EV metrics locally, inserts pairings in matches,
    and returns 3 top matched recommendations.
    """
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase connection not initialized on backend."
        )

    try:
        # 1. Fetch user's profile
        user_res = supabase_client.table("profiles").select("*").eq("id", str(user_id)).execute()
        if not user_res.data:
            raise HTTPException(status_code=404, detail="User profile not found.")
        user_profile = user_res.data[0]

        # Convert similarity vector representation
        vector_str = user_profile["similarity_vector"]
        
        # 2. Query nearest neighbor profiles using SQL RPC function
        candidates_res = supabase_client.rpc(
            "get_recommended_matches",
            {
                "caller_id": str(user_id),
                "caller_gender": user_profile["gender"],
                "caller_orientation": user_profile["orientation"],
                "caller_vector": vector_str,
                "max_limit": 15 # fetch a small pool to filter locally
            }
        ).execute()

        if not candidates_res.data:
            return []

        # Calculate dynamic target extraversion based on the candidates pool: clamp(mean(E_candidates) * 2.0, 0.6, 1.4)
        avg_candidate_e = sum(candidate["extraversion"] for candidate in candidates_res.data) / len(candidates_res.data) if candidates_res.data else 0.5
        dynamic_target_t = max(0.6, min(1.4, avg_candidate_e * 2.0))

        # Query successful match feedback to construct dynamic toxicity coop counts (avoiding overfitting, N>=100)
        coop_counts = Counter()
        try:
            feedback_res = supabase_client.table("match_feedback").select("style_p, style_q").eq("cooperated", True).execute()
            if feedback_res.data:
                coop_counts = Counter(
                    tuple(sorted([row["style_p"], row["style_q"]])) for row in feedback_res.data
                )
        except Exception as fe:
            print(f"[supabase] match_feedback fetch warning: {fe}")

        user_hesitated = bool(user_profile.get("hesitated", False))
        user_red_quota = int(user_profile.get("redemption_quota", 0))
        user_avoidant_bias = float(user_profile.get("avoidant_bias", 0.0))
        user_ghosting_count = int(user_profile.get("ghosting_count", 0))
        
        m_red_p = float(get_redemption_multiplier(user_red_quota))
        m_ghost_p = float(get_ghosting_multiplier(user_ghosting_count))

        # 3. Calculate final EV compatibility scores locally
        matches_scored = []
        for candidate in candidates_res.data:
            c_id = UUID(candidate["id"])
            candidate_hesitated = bool(candidate.get("hesitated", False))
            candidate_red_quota = int(candidate.get("redemption_quota", 0))
            candidate_avoidant_bias = float(candidate.get("avoidant_bias", 0.0))
            candidate_ghosting_count = int(candidate.get("ghosting_count", 0))
            
            m_red_q = float(get_redemption_multiplier(candidate_red_quota))
            m_ghost_q = float(get_ghosting_multiplier(candidate_ghosting_count))
            
            # Math engine computations (float() handles 0-dim numpy arrays from scalar inputs)
            sim = float(calculate_similarity(
                user_profile["cognitive_depth"], candidate["cognitive_depth"],
                user_profile["conscientiousness"], candidate["conscientiousness"]
            ))
            
            comp = float(calculate_complementarity(
                user_profile["extraversion"], candidate["extraversion"], target=dynamic_target_t
            ))
            
            # Dynamic toxicity: get count for this style pair
            pair_key = tuple(sorted([user_profile["attachment_style"], candidate["attachment_style"]]))
            coop_count = coop_counts.get(pair_key, 0)
            
            tox_mult = float(get_toxicity_multiplier(
                user_profile["attachment_style"], candidate["attachment_style"], 
                coop_count=coop_count,
                avoidant_bias_p=user_avoidant_bias,
                avoidant_bias_q=candidate_avoidant_bias
            ))
            
            cheat_mult = float(get_calibration_multiplier(
                user_profile["avg_response_time"], candidate["avg_response_time"],
                hesitated_p=user_hesitated, hesitated_q=candidate_hesitated
            ))

            # EV compatibility formula: (0.6 * similarity + 0.4 * complementarity) * toxicity * anti-cheat * redemption * ghosting multipliers
            base_score = (0.6 * sim) + (0.4 * comp)
            final_score = base_score * tox_mult * cheat_mult * m_red_p * m_red_q * m_ghost_p * m_ghost_q
            
            # Format labels
            ext_sum = user_profile["extraversion"] + candidate["extraversion"]
            if ext_sum < 0.6:
                comp_label = "Tichá harmónia (Introvert + Introvert)"
            elif ext_sum > 1.4:
                comp_label = "Dynamická energia (Extrovert + Extrovert)"
            else:
                comp_label = "Vyvážená komplementarita"

            is_secure_match = user_profile["attachment_style"] == "Secure" and candidate["attachment_style"] == "Secure"
            safety_label = "Maximálne bezpečné" if is_secure_match else "Štandardné spojenie"

            matches_scored.append({
                "candidate_profile": candidate,
                "ev_score": float(final_score * 100.0),
                "similarity_pct": float(sim * 100.0),
                "complementarity_label": comp_label,
                "attachment_safety": safety_label
            })

        # 4. Sort candidates by score descending
        matches_scored.sort(key=lambda x: x["ev_score"], reverse=True)
        top_matches = matches_scored[:3]

        # 5. Insert pairings into matches table to register them for live chat room access
        output = []
        for m in top_matches:
            candidate = m["candidate_profile"]
            
            # Sort IDs to maintain user_p < user_q constraint
            sorted_users = sorted([str(user_id), candidate["id"]])
            
            match_payload = {
                "user_p": sorted_users[0],
                "user_q": sorted_users[1],
                "ev_score": m["ev_score"]
            }
            
            # Create match or fetch existing
            match_res = supabase_client.table("matches").upsert(
                match_payload, on_conflict="user_p,user_q"
            ).execute()
            
            if match_res.data:
                match_id = match_res.data[0]["id"]
                output.append(
                    MatchResponse(
                        id=UUID(match_id),
                        name=candidate["name"],
                        age=candidate["age"],
                        city=candidate["city"],
                        ev_score=m["ev_score"],
                        similarity_pct=m["similarity_pct"],
                        complementarity_label=m["complementarity_label"],
                        attachment_safety=m["attachment_safety"]
                    )
                )

        return output
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Matches generation failed: {e}")

@app.post("/api/messages/send-voice", status_code=status.HTTP_201_CREATED)
async def send_voice_message(msg: VoiceMessageSend):
    """
    Inserts a voice message. Evaluates cumulative audio duration in the match.
    Returns status and whether the 180s threshold has been reached.
    """
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase connection not initialized on backend."
        )

    try:
        # Insert message record
        payload = {
            "match_id": str(msg.match_id),
            "sender_id": str(msg.sender_id),
            "media_url": msg.media_url,
            "duration": msg.duration
        }
        supabase_client.table("messages").insert(payload).execute()

        # Sum durations in this match
        messages_res = supabase_client.table("messages").select("duration").eq("match_id", str(msg.match_id)).execute()
        total_duration = sum(item["duration"] for item in messages_res.data) if messages_res.data else 0.0

        # Trigger Blind Vote state if total duration reaches 180s
        blind_vote_trigger = total_duration >= 180.0

        return {
            "status": "ok",
            "total_duration": total_duration,
            "blind_vote_trigger": blind_vote_trigger
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record message: {e}")

@app.post("/api/matches/vote", status_code=status.HTTP_200_OK)
async def submit_blind_vote(vote: VoteSubmit):
    """
    Registers a vote in Prisoner's Dilemma. 
    If both choose 'unlock', sets matches.is_unlocked = True.
    If either chooses 'cancel', deletes the match.
    """
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase connection not initialized on backend."
        )

    try:
        # Record vote
        vote_payload = {
            "match_id": str(vote.match_id),
            "user_id": str(vote.user_id),
            "vote": vote.vote
        }
        supabase_client.table("blind_votes").upsert(vote_payload).execute()

        # Fetch other partner votes
        votes_res = supabase_client.table("blind_votes").select("*").eq("match_id", str(vote.match_id)).execute()
        
        if len(votes_res.data) == 2:
            vote_p = votes_res.data[0]["vote"]
            vote_q = votes_res.data[1]["vote"]

            # Record feedback to public.match_feedback before updating/deleting the match
            try:
                match_info_res = supabase_client.table("matches").select("user_p, user_q").eq("id", str(vote.match_id)).execute()
                if match_info_res.data:
                    up_id = match_info_res.data[0]["user_p"]
                    uq_id = match_info_res.data[0]["user_q"]
                    
                    p_profile = supabase_client.table("profiles").select("attachment_style").eq("id", up_id).execute()
                    q_profile = supabase_client.table("profiles").select("attachment_style").eq("id", uq_id).execute()
                    
                    if p_profile.data and q_profile.data:
                        style_p = p_profile.data[0]["attachment_style"]
                        style_q = q_profile.data[0]["attachment_style"]
                        
                        cooperated = (vote_p == "unlock" and vote_q == "unlock")
                        supabase_client.table("match_feedback").insert({
                            "match_id": str(vote.match_id),
                            "style_p": style_p,
                            "style_q": style_q,
                            "cooperated": cooperated
                        }).execute()
            except Exception as feedback_err:
                print(f"[supabase] Failed to record match feedback: {feedback_err}")

            if vote_p == "unlock" and vote_q == "unlock":
                # Unlock match (Unblur profile, permit text)
                supabase_client.table("matches").update({"is_unlocked": True}).eq("id", str(vote.match_id)).execute()
                return {"status": "ok", "outcome": "unlocked"}
            else:
                # Veto/Cancel triggered by either player -> delete match permanently (Prisoner's Dilemma)
                supabase_client.table("matches").delete().eq("id", str(vote.match_id)).execute()
                return {"status": "ok", "outcome": "deleted"}
        
        return {"status": "ok", "outcome": "waiting_for_partner"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vote processing failed: {e}")

class ClosureSubmit(BaseModel):
    match_id: UUID
    user_id: UUID
    reason: str

@app.post("/api/matches/closure")
async def close_match_protocol(closure: ClosureSubmit):
    """
    Closure Protocol (Honorable Exit).
    Closes the match by setting status to 'closed', saving the closure reason,
    and making the chat read-only for both sides. No penalties are applied.
    """
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase connection not initialized on backend."
        )
    try:
        supabase_client.table("matches").update({
            "status": "closed",
            "closure_reason": closure.reason
        }).eq("id", str(closure.match_id)).execute()
        
        print(f"[closure-protocol] Match {closure.match_id} closed by {closure.user_id}. Reason: {closure.reason}")
        return {"status": "ok", "message": "Match closed under the Closure Protocol."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Closure failed: {e}")

@app.post("/api/matches/pressure-submit")
async def submit_pressure_test(data: PressureSubmit):
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase connection not initialized on backend."
        )

    try:
        # 1. Fetch match to determine if the user is user_p or user_q
        match_res = supabase_client.table("matches").select("*").eq("id", str(data.match_id)).execute()
        if not match_res.data:
            raise HTTPException(status_code=404, detail="Match not found.")
        match_info = match_res.data[0]

        user_p_id = match_info["user_p"]
        user_q_id = match_info["user_q"]

        # 2. Determine which user is submitting and prepare updates for matches table
        match_update = {}
        is_user_p = str(data.user_id) == user_p_id
        is_user_q = str(data.user_id) == user_q_id

        if not is_user_p and not is_user_q:
            raise HTTPException(status_code=400, detail="User is not part of this match.")

        if is_user_p:
            match_update = {
                "user_p_pressure_response": data.style,
                "user_p_pressure_rt": data.response_time,
                "user_p_pressure_hesitated": data.hesitated
            }
        else:
            match_update = {
                "user_q_pressure_response": data.style,
                "user_q_pressure_rt": data.response_time,
                "user_q_pressure_hesitated": data.hesitated
            }

        # 3. Update profiles completed_pressure_scenarios and new style/response_time/hesitated
        profile_res = supabase_client.table("profiles").select("*").eq("id", str(data.user_id)).execute()
        if profile_res.data:
            p_data = profile_res.data[0]
            scenarios = p_data.get("completed_pressure_scenarios") or []
            if data.scenario_id not in scenarios:
                scenarios.append(data.scenario_id)
            
            # Blend response time
            old_rt = p_data.get("avg_response_time", 3.0)
            new_rt = (old_rt + data.response_time) / 2.0
            
            # Update profile in database
            supabase_client.table("profiles").update({
                "attachment_style": data.style,
                "avg_response_time": new_rt,
                "hesitated": data.hesitated,
                "completed_pressure_scenarios": scenarios
            }).eq("id", str(data.user_id)).execute()

        # Update the matches table
        supabase_client.table("matches").update(match_update).eq("id", str(data.match_id)).execute()

        # Fetch the updated match info to check if both users have submitted
        updated_match_res = supabase_client.table("matches").select("*").eq("id", str(data.match_id)).execute()
        updated_match = updated_match_res.data[0]

        res_p = updated_match.get("user_p_pressure_response")
        res_q = updated_match.get("user_q_pressure_response")

        if res_p and res_q:
            # Both have submitted! Perform re-scoring and set status to completed.
            p_profile_res = supabase_client.table("profiles").select("*").eq("id", user_p_id).execute()
            q_profile_res = supabase_client.table("profiles").select("*").eq("id", user_q_id).execute()

            if p_profile_res.data and q_profile_res.data:
                profile_p = p_profile_res.data[0]
                profile_q = q_profile_res.data[0]

                # We calculate dynamic target extraversion based on these two users as a fallback, or fetch all active profiles
                sim = float(calculate_similarity(
                    profile_p["cognitive_depth"], profile_q["cognitive_depth"],
                    profile_p["conscientiousness"], profile_q["conscientiousness"]
                ))
                comp = float(calculate_complementarity(
                    profile_p["extraversion"], profile_q["extraversion"], target=1.0
                ))

                # Query match feedback
                coop_counts = Counter()
                try:
                    feedback_res = supabase_client.table("match_feedback").select("style_p, style_q").eq("cooperated", True).execute()
                    if feedback_res.data:
                        coop_counts = Counter(
                            tuple(sorted([row["style_p"], row["style_q"]])) for row in feedback_res.data
                        )
                except Exception:
                    pass

                pair_key = tuple(sorted([profile_p["attachment_style"], profile_q["attachment_style"]]))
                coop_count = coop_counts.get(pair_key, 0)

                tox_mult = float(get_toxicity_multiplier(
                    profile_p["attachment_style"], profile_q["attachment_style"],
                    coop_count=coop_count,
                    avoidant_bias_p=profile_p.get("avoidant_bias", 0.0),
                    avoidant_bias_q=profile_q.get("avoidant_bias", 0.0)
                ))

                cheat_mult = float(get_calibration_multiplier(
                    profile_p["avg_response_time"], profile_q["avg_response_time"],
                    hesitated_p=profile_p.get("hesitated", False), hesitated_q=profile_q.get("hesitated", False)
                ))

                m_red_p = float(get_redemption_multiplier(profile_p.get("redemption_quota", 0)))
                m_red_q = float(get_redemption_multiplier(profile_q.get("redemption_quota", 0)))
                m_ghost_p = float(get_ghosting_multiplier(profile_p.get("ghosting_count", 0)))
                m_ghost_q = float(get_ghosting_multiplier(profile_q.get("ghosting_count", 0)))

                base_score = (0.6 * sim) + (0.4 * comp)
                final_score = base_score * tox_mult * cheat_mult * m_red_p * m_red_q * m_ghost_p * m_ghost_q
                new_ev_score = float(final_score * 100.0)

                # Update match in database
                supabase_client.table("matches").update({
                    "ev_score": new_ev_score,
                    "pressure_test_status": "completed"
                }).eq("id", str(data.match_id)).execute()

                print(f"[pressure-chat] Match {data.match_id} re-scored. New EV: {new_ev_score:.2f}%")
                return {
                    "status": "ok",
                    "pressure_test_status": "completed",
                    "new_ev_score": new_ev_score
                }

        return {
            "status": "ok",
            "pressure_test_status": "active",
            "message": "Response submitted, waiting for partner."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pressure test submit failed: {e}")

@app.post("/api/cron/ghosting-check")
async def run_ghosting_check():
    """
    Cron endpoint that scans active matches, identifies those idle for 48h (warns)
    or 72h (ghosted - deletes match and penalises the ghoster).
    """
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase connection not initialized on backend."
        )
        
    try:
        matches_res = supabase_client.table("matches").select("*").eq("status", "active").execute()
        
        warned_count = 0
        ghosted_count = 0
        
        import datetime
        from dateutil.parser import parse
        
        now = datetime.datetime.now(datetime.timezone.utc)
        
        for match in matches_res.data:
            # Safely check last interaction date
            last_interaction = parse(match.get("last_interaction_at") or match["created_at"])
            diff_hours = (now - last_interaction).total_seconds() / 3600.0
            
            if diff_hours >= 72.0:
                last_sender = match.get("last_sender_id")
                if not last_sender:
                    ghoster_id = match["user_q"]
                else:
                    ghoster_id = match["user_q"] if last_sender == match["user_p"] else match["user_p"]
                
                # Fetch profile
                profile_res = supabase_client.table("profiles").select("ghosting_count, avoidant_bias").eq("id", ghoster_id).execute()
                if profile_res.data:
                    current_ghost = profile_res.data[0].get("ghosting_count", 0)
                    current_bias = profile_res.data[0].get("avoidant_bias", 0.0)
                    
                    supabase_client.table("profiles").update({
                        "ghosting_count": current_ghost + 1,
                        "avoidant_bias": min(1.0, current_bias + 0.2)
                    }).eq("id", ghoster_id).execute()
                
                supabase_client.table("matches").update({
                    "status": "deleted",
                    "closure_reason": "Automatičené zrušenie pre nečinnosť (Ghosting)"
                }).eq("id", match["id"]).execute()
                
                ghosted_count += 1
                
            elif diff_hours >= 48.0:
                warned_count += 1
                print(f"[ghosting-check] Warning user: match {match['id']} has been idle for 48h.")
                
        return {
            "status": "ok",
            "message": "Ghosting detection check completed.",
            "warned_matches": warned_count,
            "ghosted_matches": ghosted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ghosting cron failed: {e}")

