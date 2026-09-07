import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase server configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify JWT Authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired JWT token", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse psychometrics payload
    const body = await req.json();
    const {
      attachment_style,
      avg_response_time,
      extraversion,
      cognitive_depth,
      conscientiousness,
      hesitated,
      top_priority,
    } = body;

    const primaryMarker = (attachment_style || "UNTESTED").toUpperCase();
    const avgLatency = typeof avg_response_time === "number" ? avg_response_time : 0;
    const evScore = typeof extraversion === "number" ? extraversion * 100 : 50;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Upsert into psychometric_ledger using service_role
    const { data: ledgerData, error: ledgerError } = await serviceClient
      .from("psychometric_ledger")
      .upsert(
        {
          user_id: user.id,
          primary_marker: primaryMarker,
          avg_decision_latency: avgLatency,
          ev_score: evScore,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (ledgerError) {
      return new Response(
        JSON.stringify({ error: "Failed to update psychometric ledger", details: ledgerError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Update profile psychometrics on profiles table
    const profileUpdates: Record<string, any> = {};
    if (attachment_style !== undefined) profileUpdates.attachment_style = attachment_style;
    if (avg_response_time !== undefined) profileUpdates.avg_response_time = avg_response_time;
    if (extraversion !== undefined) profileUpdates.extraversion = extraversion;
    if (cognitive_depth !== undefined) profileUpdates.cognitive_depth = cognitive_depth;
    if (conscientiousness !== undefined) profileUpdates.conscientiousness = conscientiousness;
    if (hesitated !== undefined) profileUpdates.hesitated = hesitated;
    if (top_priority !== undefined) profileUpdates.top_priority = top_priority;
    if (cognitive_depth !== undefined && conscientiousness !== undefined) {
      profileUpdates.similarity_vector = `[${cognitive_depth},${conscientiousness}]`;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await serviceClient
        .table("profiles")
        .update(profileUpdates)
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Psychometrics recorded in ledger successfully.",
        user_id: user.id,
        ledger: ledgerData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
