import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Credential {
  name: string;
  email: string;
  password: string;
}

// Sends each newly-imported student their login email + 6-digit pass
// code via Resend. Requires the RESEND_API_KEY secret to be set
// (npx supabase secrets set RESEND_API_KEY=...); RESEND_FROM_EMAIL can
// optionally override the default sender.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Email sending is not configured yet (missing RESEND_API_KEY).' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('user_type')
      .eq('user_id', user.id)
      .single();

    if (profileError || !['organizer', 'super_admin'].includes(profile?.user_type)) {
      throw new Error('Only organizers can send login emails');
    }

    const { credentials, site_url } = await req.json() as { credentials: Credential[]; site_url?: string };
    if (!Array.isArray(credentials) || credentials.length === 0) {
      return new Response(JSON.stringify({ error: 'No credentials to email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const loginUrl = site_url ? `${site_url.replace(/\/$/, '')}/login` : 'the Parliament login page';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Young Indians Parliament <onboarding@resend.dev>';

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const cred of credentials) {
      try {
        const html = `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#13298f;">Welcome to the Young Indians Parliament, ${cred.name}!</h2>
            <p>Your delegate account is ready. Here are your login details:</p>
            <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding:8px; font-weight:bold; background:#f2f4f6;">Login Email</td><td style="padding:8px; background:#f2f4f6;">${cred.email}</td></tr>
              <tr><td style="padding:8px; font-weight:bold;">Login Code</td><td style="padding:8px; font-size:20px; letter-spacing:4px; font-weight:bold;">${cred.password}</td></tr>
            </table>
            <p>Go to <a href="${loginUrl}" style="color:#13298f;">${loginUrl}</a> and either:</p>
            <ul>
              <li>Sign in with your email and the code above as your password, or</li>
              <li>Tap "Login Code" and just enter your 6-digit code &mdash; no email needed.</li>
            </ul>
            <p style="color:#888; font-size:12px;">Keep this code safe &mdash; it's your permanent password for the session.</p>
          </div>
        `;

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: cred.email,
            subject: 'Your Young Indians Parliament login details',
            html,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body);
        }

        sent++;
      } catch (error) {
        failed++;
        errors.push(`${cred.name} (${cred.email}): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Stay comfortably under Resend's default rate limit (2 req/sec).
      await new Promise(resolve => setTimeout(resolve, 550));
    }

    return new Response(JSON.stringify({ sent, failed, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-login-emails function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
