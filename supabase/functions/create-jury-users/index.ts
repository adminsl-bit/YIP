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
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: juryUser.email,
        password: juryUser.password,
        email_confirm: true,
      })

      if (authError) {
        console.error(`Error creating jury user ${juryUser.email}:`, authError)
        results.push({ email: juryUser.email, success: false, error: authError.message })
        continue
      }

      if (!authData.user) {
        results.push({ email: juryUser.email, success: false, error: 'No user returned' })
        continue
      }

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          name: juryUser.name,
          position: juryUser.position,
          serial_number: juryUser.serial_number,
          party_number: 0,
          user_type: 'jury',
          email: juryUser.email,
        })

      if (profileError) {
        console.error(`Error creating profile for ${juryUser.email}:`, profileError)
        results.push({ email: juryUser.email, success: false, error: profileError.message })
        continue
      }

      results.push({ email: juryUser.email, success: true })
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
