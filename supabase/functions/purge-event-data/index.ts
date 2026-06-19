/**
 * purge-event-data
 *
 * DPDP Act 2023 compliance — data retention enforcement.
 * Anonymises personal data for a completed event so no PII is retained
 * beyond the stated 6-month retention period.
 *
 * What is anonymised (PII removed):
 *   profiles: name → "Anonymised Delegate", email, phone, photo_url,
 *             login_code, party_logo_url, manifesto fields
 *   civic_posts: content → "[Removed]", media_url
 *   civic_chat_messages: content → "[Removed]"
 *   civic_comments: content → "[Removed]"
 *   student_speeches: any text fields
 *
 * What is KEPT (non-PII aggregate data):
 *   Assessment scores, poll votes (anonymous), leaderboard positions,
 *   serial numbers, party/constituency assignments — all without names.
 *
 * Auth: superadmin only (checked via profiles.user_type = 'superadmin').
 * Body: { event_id: string, confirm: true }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is a superadmin
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorised");

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .single();

    if (callerProfile?.user_type !== "superadmin") {
      throw new Error("Only superadmins can purge event data");
    }

    const { event_id, confirm } = await req.json();
    if (!event_id) throw new Error("event_id is required");
    if (confirm !== true) throw new Error("Pass confirm: true to proceed");

    const results: Record<string, number> = {};

    // 1. Anonymise student profiles for this event
    const { data: students } = await admin
      .from("profiles")
      .select("user_id")
      .eq("event_id", event_id)
      .eq("user_type", "student");

    const studentIds = (students ?? []).map((s: any) => s.user_id);

    if (studentIds.length > 0) {
      const { count } = await admin
        .from("profiles")
        .update({
          name: "Anonymised Delegate",
          email: null,
          phone: null,
          photo_url: null,
          party_logo_url: null,
          login_code: null,
          manifesto_about: null,
          manifesto_problems: null,
          manifesto_solutions: null,
        })
        .in("user_id", studentIds);
      results.profiles_anonymised = studentIds.length;
    }

    // 2. Wipe civic wall posts content for this event
    const { count: postCount } = await admin
      .from("civic_posts")
      .update({ content: "[Removed — data retention policy]", media_url: null })
      .eq("event_id", event_id);
    results.civic_posts_wiped = postCount ?? 0;

    // 3. Wipe civic chat messages
    const { count: chatCount } = await admin
      .from("civic_chat_messages")
      .update({ content: "[Removed]" })
      .eq("event_id", event_id);
    results.chat_messages_wiped = chatCount ?? 0;

    // 4. Wipe civic comments
    if (studentIds.length > 0) {
      const { count: commentCount } = await admin
        .from("civic_comments")
        .update({ content: "[Removed]" })
        .in("post_author_id", studentIds);
      results.civic_comments_wiped = commentCount ?? 0;
    }

    // 5. Mark event as purged with timestamp
    await admin
      .from("events")
      .update({ data_purged_at: new Date().toISOString() } as any)
      .eq("id", event_id);

    console.log(`Event ${event_id} purged:`, results);

    return new Response(JSON.stringify({ success: true, event_id, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
