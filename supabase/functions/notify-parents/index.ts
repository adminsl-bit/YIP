/**
 * notify-parents
 *
 * DPDP Act 2023 §9 — digital parental consent notification.
 * Sent automatically after a bulk student import when parent email addresses
 * are provided in the import sheet.
 *
 * The email informs the parent/guardian:
 *   - Their child has been registered for YIP
 *   - What personal data is collected and why
 *   - Where it is stored (South Korea / Supabase, protected by PIPA)
 *   - The 6-month retention period
 *   - How to opt out / request deletion within 48 hours
 *
 * This creates an auditable digital notification record that supports
 * compliance with Section 9 when physical consent forms are not feasible.
 *
 * Requires: RESEND_API_KEY environment variable.
 * Body: { parents: [{ parentEmail, studentName }], site_url }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

    const { parents, site_url } = await req.json() as {
      parents: { parentEmail: string; studentName: string }[];
      site_url: string;
    };

    if (!Array.isArray(parents) || parents.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const { parentEmail, studentName } of parents) {
      if (!parentEmail || !parentEmail.includes("@")) continue;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <div style="background: #13298f; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 900;">
              Young Indians Parliament
            </h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">
              Data Protection Notice — DPDP Act 2023
            </p>
          </div>

          <div style="background: #f8f9ff; padding: 32px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px;">Dear Parent / Guardian,</p>

            <p style="margin: 0 0 16px;">
              Your child / ward <strong>${studentName}</strong> has been registered as a delegate for an upcoming
              <strong>Young Indians Parliament (YIP)</strong> simulation event organised by Young Indians (Yi),
              a wing of the Confederation of Indian Industry (CII).
            </p>

            <div style="background: white; border-left: 4px solid #13298f; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 0 0 20px;">
              <p style="margin: 0 0 8px; font-weight: 700; font-size: 13px; color: #13298f;">
                Personal data collected for the event:
              </p>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8; color: #374151;">
                <li>Name and school</li>
                <li>City and state (for constituency assignment)</li>
                <li>Email address (if provided — used for login credentials)</li>
                <li>Profile photo (optional, uploaded by the student)</li>
                <li>Participation data: poll votes, speeches, chat messages, assessment scores</li>
              </ul>
            </div>

            <div style="background: #fffbeb; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 0 0 20px; font-size: 13px;">
              <p style="margin: 0 0 6px; font-weight: 700; color: #92400e;">Data storage location:</p>
              <p style="margin: 0; color: #78350f;">
                Data is stored on servers in <strong>South Korea</strong> via Supabase, which is protected by
                South Korea's <strong>Personal Information Protection Act (PIPA)</strong> — one of Asia's
                strongest data protection laws.
              </p>
            </div>

            <p style="margin: 0 0 16px; font-size: 13px;">
              <strong>Retention:</strong> All personal data will be permanently deleted or anonymised within
              6 months of the event end date.
            </p>

            <div style="background: #fee2e2; border: 1px solid #f87171; padding: 16px; border-radius: 8px; margin: 0 0 24px; font-size: 13px;">
              <p style="margin: 0; font-weight: 700; color: #991b1b;">
                To object or withdraw within 48 hours:
              </p>
              <p style="margin: 6px 0 0; color: #7f1d1d;">
                Email <a href="mailto:privacy@yi.org.in" style="color: #13298f;">privacy@yi.org.in</a> with
                subject <em>"DPDP Objection — ${studentName}"</em> and we will remove the registration.
                You may also request access, correction, or deletion of data at any time using the same address.
              </p>
            </div>

            <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
              This notification is sent in accordance with Section 9 of the Digital Personal Data Protection
              Act, 2023 (India). For more information, read our{' '}
              <a href="${site_url}/privacy" style="color: #13298f;">Privacy Policy</a>.
            </p>

            <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
              Young Indians (Yi) · Confederation of Indian Industry · New Delhi, India<br/>
              This is an automated notification. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          "accept": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "Young Indians Parliament", email: "noreply@yi.org.in" },
          to: [{ email: parentEmail }],
          subject: `YIP Participation Notice — ${studentName}`,
          htmlContent: html,
        }),
      });

      if (res.ok) { sent++; } else { failed++; }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
