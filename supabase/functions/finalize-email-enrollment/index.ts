import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Identify the calling user from their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) throw new Error('Unauthorized');

    const { loginId, password } = await req.json();

    if (!loginId || !password) throw new Error('loginId and password are required');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');

    const newEmail = `${loginId.toLowerCase().trim()}@yip.parliament`;

    // Check the loginId isn't already taken by another user
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', newEmail)
      .neq('user_id', user.id)
      .maybeSingle();

    if (existing) throw new Error('That Login ID is already taken. Please choose another.');

    // Use admin API — updates email without sending a confirmation email and sets password atomically
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email: newEmail, password, email_confirm: true }
    );
    if (updateError) throw updateError;

    // Keep the profile email field in sync
    await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail })
      .eq('user_id', user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
