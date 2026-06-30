// Supabase Edge Function: Matchmaker
// Located at: supabase/functions/matchmaker/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request JSON
    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id parameter" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Fetch user's profile
    const { data: userProfile, error: userError } = await supabaseClient
      .table("profiles")
      .select("*")
      .eq("id", user_id)
      .single()

    if (userError || !userProfile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Query nearest neighbor profiles using SQL RPC function
    const { data: candidates, error: candidatesError } = await supabaseClient.rpc(
      "get_recommended_matches",
      {
        caller_id: user_id,
        caller_gender: userProfile.gender,
        caller_orientation: userProfile.orientation,
        caller_vector: userProfile.similarity_vector,
        max_limit: 15
      }
    )

    if (candidatesError) {
      return new Response(JSON.stringify({ error: candidatesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Fetch successful match feedback counts for dynamic toxicity calculation (avoid overfitting)
    const { data: feedbackData } = await supabaseClient
      .table("match_feedback")
      .select("style_p, style_q")
      .eq("cooperated", true)

    const coopCounts: Record<string, number> = {}
    if (feedbackData) {
      for (const row of feedbackData) {
        const key = [row.style_p, row.style_q].sort().join("-")
        coopCounts[key] = (coopCounts[key] ?? 0) + 1
      }
    }

    // Calculate dynamic target extraversion based on candidates pool: clamp(mean(E_candidates) * 2, 0.6, 1.4)
    const avgCandidateE = candidates.reduce((sum: number, c: any) => sum + c.extraversion, 0) / candidates.length
    const dynamicTargetT = Math.max(0.6, Math.min(1.4, avgCandidateE * 2.0))

    // 4. Calculate final EV compatibility scores locally
    const scoredMatches = candidates.map((candidate: any) => {
      // 4.1. Similarity calculation (1 - Euclidean / sqrt(2))
      const simDist = Math.sqrt(
        Math.pow(userProfile.cognitive_depth - candidate.cognitive_depth, 2) +
        Math.pow(userProfile.conscientiousness - candidate.conscientiousness, 2)
      )
      const sim = 1.0 - (simDist / Math.sqrt(2.0))

      // 4.2. Asymmetric Complementarity with dynamic target
      const extSum = userProfile.extraversion + candidate.extraversion
      const dComp = extSum < dynamicTargetT 
        ? 0.5 * (dynamicTargetT - extSum) 
        : 1.0 * (extSum - dynamicTargetT)
      const comp = 1.0 - Math.min(1.0, Math.max(0.0, dComp))

      // 4.3. Adaptive Toxicity Penalties
      const spNorm = userProfile.attachment_style.trim().substring(0, 3).toLowerCase()
      const sqNorm = candidate.attachment_style.trim().substring(0, 3).toLowerCase()
      
      const matrix: Record<string, Record<string, number>> = {
        sec: { sec: 0.0, anx: -0.15, avo: -0.20, fea: -0.25 },
        anx: { sec: -0.15, anx: -0.40, avo: -1.00, fea: -0.60 },
        avo: { sec: -0.20, anx: -1.00, avo: -0.50, fea: -0.60 },
        fea: { sec: -0.25, anx: -0.60, avo: -0.60, fea: -0.70 }
      }

      const pStyle = matrix[spNorm] ? spNorm : "sec"
      const qStyle = matrix[sqNorm] ? sqNorm : "sec"
      let penalty = matrix[pStyle][qStyle] ?? 0.0

      // Soften penalty by 25% if we have at least 100 successful cooperations
      const pairKey = [userProfile.attachment_style, candidate.attachment_style].sort().join("-")
      const coopCount = coopCounts[pairKey] ?? 0
      if (coopCount >= 100) {
        penalty = penalty * 0.75
      }

      const mTox = Math.max(0.0, Math.min(1.0, 1.0 + penalty))

      // 4.4. Anti-Cheat Response time calibration
      const calculateDiscount = (rt: number, tMin = 2.0) => {
        const discount = rt >= tMin ? 1.0 : rt / tMin
        return Math.max(0.1, Math.min(1.0, discount))
      }
      const mCheat = calculateDiscount(userProfile.avg_response_time) * calculateDiscount(candidate.avg_response_time)

      // 4.5. Final Expected Value compatibility score
      const baseScore = (0.6 * sim) + (0.4 * comp)
      const finalScore = baseScore * mTox * mCheat

      let compLabel = "Vyvážená komplementarita"
      if (extSum < 0.6) {
        compLabel = "Tichá harmónia (Introvert + Introvert)"
      } else if (extSum > 1.4) {
        compLabel = "Dynamická energia (Extrovert + Extrovert)"
      }

      const isSecureMatch = userProfile.attachment_style === "Secure" && candidate.attachment_style === "Secure"
      const safetyLabel = isSecureMatch ? "Maximálne bezpečné" : "Štandardné spojenie"

      return {
        candidate,
        ev_score: finalScore * 100.0,
        similarity_pct: sim * 100.0,
        complementarity_label: compLabel,
        attachment_safety: safetyLabel
      }
    })

    // Sort descending by EV compatibility score
    scoredMatches.sort((a: any, b: any) => b.ev_score - a.ev_score)
    const topMatches = scoredMatches.slice(0, 3)

    // 5. Upsert recommended pairings into matches table
    const output = []
    for (const m of topMatches) {
      const sortedUsers = [user_id, m.candidate.id].sort()
      const { data: matchRes } = await supabaseClient
        .table("matches")
        .upsert({
          user_p: sortedUsers[0],
          user_q: sortedUsers[1],
          ev_score: m.ev_score
        }, { onConflict: "user_p,user_q" })
        .select()

      if (matchRes && matchRes.length > 0) {
        output.push({
          id: matchRes[0].id,
          name: m.candidate.name,
          age: m.candidate.age,
          city: m.candidate.city,
          ev_score: m.ev_score,
          similarity_pct: m.similarity_pct,
          complementarity_label: m.complementarity_label,
          attachment_safety: m.attachment_safety
        })
      }
    }

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
