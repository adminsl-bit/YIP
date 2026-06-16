import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Public endpoint: resolves a student's 6-digit login code to their email,
// so the client can complete sign-in with supabase.auth.signInWithPassword
// without the student ever typing their email. The code IS the student's
// password, so this lookup grants no more than knowing the code already did.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { code } = await req.json();
    const trimmed = (code ?? '').toString().trim();

    if (!/^\d{6}$/.test(trimmed)) {
      return new Response(JSON.stringify({ error: 'Enter the 6-digit code from your login sheet.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('login_code', trimmed)
      .eq('user_type', 'student')
      .maybeSingle();

    if (error || !profile) {
      return new Response(JSON.stringify({ error: 'Invalid or unrecognised code.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ email: profile.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in login-with-code function:', error);
    return new Response(JSON.stringify({ error: 'Unexpected error. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
