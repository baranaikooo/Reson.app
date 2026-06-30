"""
Integration tests for the FastAPI Reson EV Matchmaking API.
Uses httpx async test client with mocked Supabase responses.
"""
import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport

# Patch supabase_client before importing server to avoid connection attempt
with patch("matching_engine.server.supabase_client") as mock_sb:
    from matching_engine.server import app

@pytest.fixture
def mock_supabase():
    """Fixture providing a mocked Supabase client."""
    mock_client = MagicMock()
    with patch("matching_engine.server.supabase_client", mock_client):
        yield mock_client

@pytest.fixture
def sample_profile():
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "TestUser",
        "age": 25,
        "city": "Bratislava",
        "gender": "male",
        "orientation": "hetero",
        "cognitive_depth": 0.7,
        "conscientiousness": 0.8,
        "extraversion": 0.4,
        "attachment_style": "Secure",
        "avg_response_time": 3.5,
        "top_priority": "stabilita",
        "similarity_vector": "[0.7,0.8]"
    }

@pytest.fixture
def sample_candidates():
    return [
        {
            "id": "00000000-0000-0000-0000-000000000002",
            "name": "PartnerA",
            "age": 24,
            "city": "Praha",
            "gender": "female",
            "orientation": "hetero",
            "cognitive_depth": 0.65,
            "conscientiousness": 0.75,
            "extraversion": 0.6,
            "attachment_style": "Secure",
            "avg_response_time": 4.0,
            "top_priority": "rodina",
            "distance": 0.07
        },
        {
            "id": "00000000-0000-0000-0000-000000000003",
            "name": "PartnerB",
            "age": 27,
            "city": "Košice",
            "gender": "female",
            "orientation": "hetero",
            "cognitive_depth": 0.3,
            "conscientiousness": 0.2,
            "extraversion": 0.9,
            "attachment_style": "Anxious",
            "avg_response_time": 1.5,
            "top_priority": "sloboda",
            "distance": 0.72
        }
    ]


# ============================================================
# Test: POST /api/profile/submit
# ============================================================

@pytest.mark.anyio
async def test_submit_profile_success(mock_supabase):
    """Profile submission should upsert to profiles table and return 201."""
    # Mock the upsert chain
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.upsert.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"id": "00000000-0000-0000-0000-000000000001"}])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/profile/submit", json={
            "user_id": "00000000-0000-0000-0000-000000000001",
            "name": "TestUser",
            "age": 25,
            "city": "Bratislava",
            "gender": "male",
            "orientation": "hetero",
            "cognitive_depth": 0.7,
            "conscientiousness": 0.8,
            "extraversion": 0.4,
            "attachment_style": "Secure",
            "avg_response_time": 3.5,
            "top_priority": "stabilita"
        })

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ok"
    mock_supabase.table.assert_called_with("profiles")


# ============================================================
# Test: GET /api/matches/daily/{user_id}
# ============================================================

@pytest.mark.anyio
async def test_daily_matches_returns_scored_list(mock_supabase, sample_profile, sample_candidates):
    """Daily matches endpoint should return sorted EV-scored candidates."""
    # Mock: profiles table fetch returns sample_profile
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq
    mock_eq.execute.return_value = MagicMock(data=[sample_profile])

    # Mock: RPC returns candidates
    mock_rpc = MagicMock()
    mock_supabase.rpc.return_value = mock_rpc
    mock_rpc.execute.return_value = MagicMock(data=sample_candidates)

    # Mock: upsert for match creation
    mock_upsert = MagicMock()
    mock_table.upsert.return_value = mock_upsert
    mock_upsert.execute.return_value = MagicMock(data=[{"id": "00000000-0000-0000-0000-aaaaaaaaaaaa"}])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/matches/daily/00000000-0000-0000-0000-000000000001")

    assert response.status_code == 200
    matches = response.json()
    assert isinstance(matches, list)
    # PartnerA (Secure+Secure, close vector) should score higher than PartnerB (Anxious, far vector)
    if len(matches) >= 2:
        assert matches[0]["ev_score"] >= matches[1]["ev_score"]


# ============================================================
# Test: POST /api/messages/send-voice
# ============================================================

@pytest.mark.anyio
async def test_send_voice_message_tracks_duration(mock_supabase):
    """Voice message should be inserted and cumulative duration calculated."""
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table

    # Mock insert
    mock_insert = MagicMock()
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = MagicMock(data=[{}])

    # Mock select for duration sum (simulate 3 messages totaling 95s)
    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq
    mock_eq.execute.return_value = MagicMock(data=[
        {"duration": 30.0},
        {"duration": 45.0},
        {"duration": 20.0}
    ])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/messages/send-voice", json={
            "match_id": "00000000-0000-0000-0000-bbbbbbbbbbbb",
            "sender_id": "00000000-0000-0000-0000-000000000001",
            "media_url": "https://storage.supabase.co/voice-messages/matches/test/msg1.wav",
            "duration": 20.0
        })

    assert response.status_code == 201
    body = response.json()
    assert body["total_duration"] == 95.0
    assert body["blind_vote_trigger"] is False


@pytest.mark.anyio
async def test_send_voice_triggers_blind_vote_at_180s(mock_supabase):
    """When cumulative duration >= 180s, blind_vote_trigger should be True."""
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table

    mock_insert = MagicMock()
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = MagicMock(data=[{}])

    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq
    mock_eq.execute.return_value = MagicMock(data=[
        {"duration": 90.0},
        {"duration": 60.0},
        {"duration": 35.0}
    ])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/messages/send-voice", json={
            "match_id": "00000000-0000-0000-0000-bbbbbbbbbbbb",
            "sender_id": "00000000-0000-0000-0000-000000000001",
            "media_url": "https://storage.supabase.co/voice-messages/matches/test/msg4.wav",
            "duration": 35.0
        })

    body = response.json()
    assert body["total_duration"] == 185.0
    assert body["blind_vote_trigger"] is True


# ============================================================
# Test: POST /api/matches/vote (Prisoner's Dilemma)
# ============================================================

@pytest.mark.anyio
async def test_blind_vote_both_unlock(mock_supabase):
    """If both players vote 'unlock', match should be unlocked."""
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table

    mock_upsert = MagicMock()
    mock_table.upsert.return_value = mock_upsert
    mock_upsert.execute.return_value = MagicMock(data=[{}])

    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq
    mock_eq.execute.return_value = MagicMock(data=[
        {"match_id": "00000000-0000-0000-0000-cccccccccccc", "user_id": "user1", "vote": "unlock"},
        {"match_id": "00000000-0000-0000-0000-cccccccccccc", "user_id": "user2", "vote": "unlock"}
    ])

    mock_update = MagicMock()
    mock_table.update.return_value = mock_update
    mock_update_eq = MagicMock()
    mock_update.eq.return_value = mock_update_eq
    mock_update_eq.execute.return_value = MagicMock(data=[{}])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/matches/vote", json={
            "match_id": "00000000-0000-0000-0000-cccccccccccc",
            "user_id": "00000000-0000-0000-0000-000000000001",
            "vote": "unlock"
        })

    body = response.json()
    assert body["outcome"] == "unlocked"


@pytest.mark.anyio
async def test_blind_vote_one_cancels_deletes_match(mock_supabase):
    """If either player votes 'cancel', match should be permanently deleted."""
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table

    mock_upsert = MagicMock()
    mock_table.upsert.return_value = mock_upsert
    mock_upsert.execute.return_value = MagicMock(data=[{}])

    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq
    mock_eq.execute.return_value = MagicMock(data=[
        {"match_id": "00000000-0000-0000-0000-cccccccccccc", "user_id": "user1", "vote": "unlock"},
        {"match_id": "00000000-0000-0000-0000-cccccccccccc", "user_id": "user2", "vote": "cancel"}
    ])

    mock_delete = MagicMock()
    mock_table.delete.return_value = mock_delete
    mock_delete_eq = MagicMock()
    mock_delete.eq.return_value = mock_delete_eq
    mock_delete_eq.execute.return_value = MagicMock(data=[{}])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/matches/vote", json={
            "match_id": "00000000-0000-0000-0000-cccccccccccc",
            "user_id": "00000000-0000-0000-0000-000000000002",
            "vote": "cancel"
        })

    body = response.json()
    assert body["outcome"] == "deleted"

@pytest.mark.anyio
async def test_closure_protocol_success(mock_supabase):
    """Verifies that match closure protocol sets match status to closed with reason."""
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_update = MagicMock()
    mock_table.update.return_value = mock_update
    mock_eq = MagicMock()
    mock_update.eq.return_value = mock_eq
    mock_eq.execute.return_value = MagicMock(data=[{"id": "00000000-0000-0000-0000-cccccccccccc", "status": "closed"}])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/matches/closure", json={
            "match_id": "00000000-0000-0000-0000-cccccccccccc",
            "user_id": "00000000-0000-0000-0000-000000000001",
            "reason": "Necítim romantickú chémiu"
        })

    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.anyio
async def test_ghosting_detector_cron(mock_supabase):
    """Verifies ghosting detection warns/penalises idle matches."""
    import datetime
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    
    # Mock active matches - one normal, one idle for 80 hours
    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq
    
    idle_time = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=80)).isoformat()
    mock_eq.execute.return_value = MagicMock(data=[
        {
            "id": "00000000-0000-0000-0000-111111111111",
            "user_p": "00000000-0000-0000-0000-000000000001",
            "user_q": "00000000-0000-0000-0000-000000000002",
            "last_interaction_at": idle_time,
            "last_sender_id": "00000000-0000-0000-0000-000000000001",
            "status": "active"
        }
    ])
    
    # Mock profiles select and update
    mock_update = MagicMock()
    mock_table.update.return_value = mock_update
    mock_update_eq = MagicMock()
    mock_update.eq.return_value = mock_update_eq
    mock_update_eq.execute.return_value = MagicMock(data=[{}])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/cron/ghosting-check")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["ghosted_matches"] == 1

@pytest.mark.anyio
async def test_submit_pressure_test_success(mock_supabase):
    """Verifies that submitting in-chat pressure test updates match data and re-scores when both sides answer."""
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    
    # 1. Mock matches select (initial call)
    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_select_eq = MagicMock()
    mock_select.eq.return_value = mock_select_eq
    
    # Match info mock returns user_p and user_q
    mock_select_eq.execute.side_effect = [
        # First call: select match
        MagicMock(data=[{
            "id": "00000000-0000-0000-0000-cccccccccccc",
            "user_p": "00000000-0000-0000-0000-000000000001",
            "user_q": "00000000-0000-0000-0000-000000000002"
        }]),
        # Second call: select profile for user (data.user_id)
        MagicMock(data=[{
            "id": "00000000-0000-0000-0000-000000000001",
            "completed_pressure_scenarios": [],
            "avg_response_time": 3.0,
            "hesitated": False,
            "attachment_style": "Secure"
        }]),
        # Third call: select updated match to check if both answered (returns both answered)
        MagicMock(data=[{
            "id": "00000000-0000-0000-0000-cccccccccccc",
            "user_p": "00000000-0000-0000-0000-000000000001",
            "user_q": "00000000-0000-0000-0000-000000000002",
            "user_p_pressure_response": "Secure",
            "user_q_pressure_response": "Anxious"
        }]),
        # Fourth call: select user_p profile for re-scoring
        MagicMock(data=[{
            "id": "00000000-0000-0000-0000-000000000001",
            "cognitive_depth": 0.7,
            "conscientiousness": 0.8,
            "extraversion": 0.4,
            "attachment_style": "Secure",
            "avg_response_time": 3.5,
            "hesitated": False
        }]),
        # Fifth call: select user_q profile for re-scoring
        MagicMock(data=[{
            "id": "00000000-0000-0000-0000-000000000002",
            "cognitive_depth": 0.65,
            "conscientiousness": 0.75,
            "extraversion": 0.6,
            "attachment_style": "Anxious",
            "avg_response_time": 2.5,
            "hesitated": False
        }]),
        # Sixth call: feedback_res
        MagicMock(data=[])
    ]

    mock_update = MagicMock()
    mock_table.update.return_value = mock_update
    mock_update_eq = MagicMock()
    mock_update.eq.return_value = mock_update_eq
    mock_update_eq.execute.return_value = MagicMock(data=[{}])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/matches/pressure-submit", json={
            "match_id": "00000000-0000-0000-0000-cccccccccccc",
            "user_id": "00000000-0000-0000-0000-000000000001",
            "scenario_id": "scenario_01_ghosting",
            "style": "Secure",
            "response_time": 2.5,
            "hesitated": False
        })

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "pressure_test_status" in response.json()


