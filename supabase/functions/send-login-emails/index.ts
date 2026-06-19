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
// code via Brevo transactional API. Requires the BREVO_API_KEY secret:
//   npx supabase secrets set BREVO_API_KEY=xkeysib-...
// BREVO_FROM_EMAIL / BREVO_FROM_NAME can override the default sender.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: 'Email sending is not configured (missing BREVO_API_KEY).' }), {
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

    const loginUrl = site_url ? `${site_url.replace(/\/$/, '')}/login` : 'https://yip-mu.vercel.app/login';
    const fromEmail = Deno.env.get('BREVO_FROM_EMAIL') ?? 'noreply@yi.org.in';
    const fromName  = Deno.env.get('BREVO_FROM_NAME')  ?? 'Young Indians Parliament';

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const cred of credentials) {
      try {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your YIP Login Credentials</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f8;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f2f4f8;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
           style="background:#ffffff;border-radius:20px;overflow:hidden;
                  box-shadow:0 8px 40px rgba(19,41,143,0.10);max-width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#13298f 0%,#1e3aad 100%);
                   padding:32px 36px;text-align:center;">
          <p style="margin:0 0 8px;font-size:10px;font-weight:900;letter-spacing:0.28em;
                    text-transform:uppercase;color:rgba(255,255,255,0.55);">
            YOUNG INDIANS (Yi) · CII
          </p>
          <h1 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
            Your Parliament Credentials
          </h1>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.70);font-weight:600;">
            Young Indians Parliament 2026
          </p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px 36px;">

          <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1a1a2e;">
            Dear ${cred.name},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#5a6380;line-height:1.75;">
            Welcome to the <strong style="color:#13298f;">Young Indians Parliament</strong> simulation.
            Your delegate account is ready — use the code below to sign in instantly from any device.
          </p>

          <!-- Login code box -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#eef1fb;border:2px solid #d5dbf5;
                        border-radius:14px;margin-bottom:24px;">
            <tr>
              <td style="padding:24px;text-align:center;">
                <p style="margin:0 0 12px;font-size:10px;font-weight:900;
                          letter-spacing:0.22em;text-transform:uppercase;color:#8892b0;">
                  YOUR 6-DIGIT LOGIN CODE
                </p>
                <p style="margin:0 0 8px;font-size:42px;font-weight:900;
                          letter-spacing:14px;color:#13298f;
                          font-family:'Courier New',Courier,monospace;">
                  ${cred.password}
                </p>
                <p style="margin:0;font-size:11px;color:#8892b0;font-weight:600;">
                  Keep this code safe — it is your permanent sign-in credential.
                </p>
              </td>
            </tr>
          </table>

          <!-- Steps -->
          <p style="margin:0 0 14px;font-size:11px;font-weight:900;letter-spacing:0.18em;
                    text-transform:uppercase;color:#a0a8c0;">HOW TO SIGN IN</p>

          <!-- Step 1 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
            <tr>
              <td width="40" valign="top" style="padding-right:12px;">
                <div style="width:30px;height:30px;background:#13298f;border-radius:50%;
                             text-align:center;line-height:30px;font-size:12px;
                             font-weight:900;color:#fff;">1</div>
              </td>
              <td valign="top" style="padding-bottom:12px;border-bottom:1px solid #f0f2f8;">
                <p style="margin:0 0 2px;font-size:13px;font-weight:800;color:#1a1a2e;">
                  Open the YIP Hub
                </p>
                <p style="margin:0;font-size:12px;color:#7a80a0;line-height:1.6;">
                  Visit
                  <a href="${loginUrl}" style="color:#13298f;text-decoration:underline;">${loginUrl}</a>
                  on any device — phone, tablet or laptop.
                </p>
              </td>
            </tr>
          </table>

          <!-- Step 2 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
            <tr>
              <td width="40" valign="top" style="padding-right:12px;">
                <div style="width:30px;height:30px;background:#13298f;border-radius:50%;
                             text-align:center;line-height:30px;font-size:12px;
                             font-weight:900;color:#fff;">2</div>
              </td>
              <td valign="top" style="padding-bottom:12px;border-bottom:1px solid #f0f2f8;">
                <p style="margin:0 0 2px;font-size:13px;font-weight:800;color:#1a1a2e;">
                  Tap the "Login Code" tab
                </p>
                <p style="margin:0;font-size:12px;color:#7a80a0;line-height:1.6;">
                  On the login page, select <strong style="color:#1a1a2e;">Login Code</strong>
                  at the top of the form.
                </p>
              </td>
            </tr>
          </table>

          <!-- Step 3 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td width="40" valign="top" style="padding-right:12px;">
                <div style="width:30px;height:30px;background:#13298f;border-radius:50%;
                             text-align:center;line-height:30px;font-size:12px;
                             font-weight:900;color:#fff;">3</div>
              </td>
              <td valign="top">
                <p style="margin:0 0 2px;font-size:13px;font-weight:800;color:#1a1a2e;">
                  Enter your 6-digit code and sign in
                </p>
                <p style="margin:0;font-size:12px;color:#7a80a0;line-height:1.6;">
                  Type the code shown above and tap
                  <strong style="color:#1a1a2e;">Sign In to Portal</strong>.
                </p>
              </td>
            </tr>
          </table>

          <!-- CTA button -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td align="center">
                <a href="${loginUrl}"
                   style="display:inline-block;
                          background:linear-gradient(135deg,#13298f 0%,#1e3aad 100%);
                          color:#ffffff;font-size:14px;font-weight:900;
                          letter-spacing:0.08em;text-transform:uppercase;
                          padding:14px 48px;border-radius:50px;
                          box-shadow:0 6px 20px rgba(19,41,143,0.28);
                          text-decoration:none;">
                  Enter Parliament &rarr;
                </a>
              </td>
            </tr>
          </table>

          <!-- Alt: email login -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#f7f8fc;border-radius:10px;padding:14px 18px;">
                <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:#5a6380;">
                  Alternatively, sign in with email + password:
                </p>
                <p style="margin:0;font-size:12px;color:#7a80a0;line-height:1.8;">
                  <strong style="color:#1a1a2e;">Email:</strong> ${cred.email}<br/>
                  <strong style="color:#1a1a2e;">Password:</strong> ${cred.password}
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f7f8fc;border-top:1px solid #eaeef8;
                   padding:20px 36px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#a0a8c0;line-height:1.8;">
            This email was sent to <strong>${cred.email}</strong> because you are registered
            as a delegate for the Young Indians Parliament simulation.<br/>
            Data handled under the DPDP Act, 2023.
            <a href="${loginUrl.replace('/login','')}/privacy"
               style="color:#13298f;text-decoration:underline;">Privacy Policy</a>
          </p>
          <p style="margin:0;font-size:10px;color:#c0c6d8;font-weight:600;letter-spacing:0.05em;">
            YOUNG INDIANS (Yi) &middot; CONFEDERATION OF INDIAN INDUSTRY &middot; NEW DELHI, INDIA
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
            'accept': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: cred.email, name: cred.name }],
            subject: `YIP 2026 — Your delegate login code: ${cred.password}`,
            htmlContent: html,
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

      // Brevo free tier allows ~10 emails/sec; 200 ms gap keeps us safe.
      await new Promise(resolve => setTimeout(resolve, 200));
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
