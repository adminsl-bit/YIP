import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const juryUsers = [
      {
        email: 'jury1@yip.com',
        password: 'jury2025',
        name: 'Jury 1',
        position: 'Senior Evaluator',
        serial_number: 1001,
      },
      {
        email: 'jury2@yip.com',
        password: 'jury2025',
        name: 'Jury 2',
        position: 'Senior Evaluator',
        serial_number: 1002,
      },
      {
        email: 'jury3@yip.com',
        password: 'jury2025',
        name: 'Jury 3',
        position: 'Senior Evaluator',
        serial_number: 1003,
      },
      {
        email: 'jury4@yip.com',
        password: 'jury2025',
        name: 'Jury 4',
        position: 'Senior Evaluator',
        serial_number: 1004,
      },
      {
        email: 'jury5@yip.com',
        password: 'jury2025',
        name: 'Jury 5',
        position: 'Senior Evaluator',
        serial_number: 1005,
      },
      {
        email: 'jury6@yip.com',
        password: 'jury2025',
        name: 'Jury 6',
        position: 'Senior Evaluator',
        serial_number: 1006,
      },
    ]

    const results = []

    for (const juryUser of juryUsers) {
      try {
        // 1) If a profile already exists for this email, update auth + profile (idempotent)
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('email', juryUser.email)
          .single();

        if (existingProfile?.user_id) {
          const userId = existingProfile.user_id as string;

          const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: juryUser.password,
            email: juryUser.email,
            email_confirm: true,
          });
          if (updateAuthError) throw new Error(`Auth update failed: ${updateAuthError.message}`);

          const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .update({
              name: juryUser.name,
              position: juryUser.position,
              serial_number: juryUser.serial_number,
              party_number: 0,
              user_type: 'jury',
              email: juryUser.email,
            })
            .eq('user_id', userId);
          if (updateProfileError) throw new Error(`Profile update failed: ${updateProfileError.message}`);

          results.push({ email: juryUser.email, success: true, action: 'updated' });
          continue;
        }

        // 2) Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: juryUser.email,
          password: juryUser.password,
          email_confirm: true,
        });

        let userId = authData?.user?.id as string | undefined;

        // If email already exists, find the existing auth user and proceed
        if (authError) {
          // Try to locate existing user via admin listUsers
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = usersList?.users?.find((u: any) => u.email?.toLowerCase() === juryUser.email.toLowerCase());
          if (!existing) {
            console.error(`Error creating jury user ${juryUser.email}:`, authError);
            results.push({ email: juryUser.email, success: false, error: authError.message });
            continue;
          }
          userId = existing.id;

          // Ensure auth password/email are up to date
          const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: juryUser.password,
            email: juryUser.email,
            email_confirm: true,
          });
          if (updateAuthError) {
            results.push({ email: juryUser.email, success: false, error: updateAuthError.message });
            continue;
          }
        }

        if (!userId) {
          results.push({ email: juryUser.email, success: false, error: 'No user id resolved' });
          continue;
        }

        // 3) Upsert profile for this auth user
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            user_id: userId,
            name: juryUser.name,
            position: juryUser.position,
            serial_number: juryUser.serial_number,
            party_number: 0,
            user_type: 'jury',
            email: juryUser.email,
          }, { onConflict: 'user_id' });

        if (profileError) {
          console.error(`Error creating/updating profile for ${juryUser.email}:`, profileError);
          results.push({ email: juryUser.email, success: false, error: profileError.message });
          continue;
        }

        results.push({ email: juryUser.email, success: true, action: authError ? 'relinked' : 'created' });
      } catch (e: any) {
        console.error(`Unexpected error for ${juryUser.email}:`, e);
        results.push({ email: juryUser.email, success: false, error: e?.message || 'Unexpected error' });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in create-jury-users function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
