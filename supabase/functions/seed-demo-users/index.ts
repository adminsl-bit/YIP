import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const demoUsers = [
      {
        email: 'demo@student.yip',
        password: '1234',
        user_type: 'student',
        profile: {
          serial_number: 9999,
          name: 'Demo Student',
          position: 'Member of Parliament',
          party_number: 1,
          constituency: 'Demo Constituency',
          state: 'Demo State',
          city: 'Demo City'
        },
        roles: []
      },
      {
        email: 'demo@admin.yip',
        password: '1234',
        user_type: 'student',
        profile: {
          serial_number: 9998,
          name: 'Demo Admin Student',
          position: 'Admin Student',
          party_number: 2,
          constituency: 'Demo Constituency',
          state: 'Demo State',
          city: 'Demo City'
        },
        roles: ['admin_student']
      },
      {
        email: 'demo@jury.yip',
        password: '1234',
        user_type: 'jury',
        profile: {
          serial_number: 9997,
          name: 'Demo Jury',
          position: 'Jury Member',
          party_number: 0,
          constituency: null,
          state: null,
          city: null
        },
        roles: []
      },
      {
        email: 'demo@organizer.yip',
        password: '1234',
        user_type: 'organizer',
        profile: {
          serial_number: 9996,
          name: 'Demo Organizer',
          position: 'Event Organizer',
          party_number: 0,
          constituency: null,
          state: null,
          city: null
        },
        roles: []
      },
      {
        email: 'demo@journalist.yip',
        password: '1234',
        user_type: 'student',
        profile: {
          serial_number: 9995,
          name: 'Demo Journalist',
          position: 'Journalist',
          party_number: 0,
          constituency: null,
          state: null,
          city: null
        },
        roles: ['journalist']
      }
    ]

    const results = []

    for (const demoUser of demoUsers) {
      // Check if user exists
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
      const userExists = existingUser?.users.find(u => u.email === demoUser.email)

      let userId: string

      if (userExists) {
        console.log(`User ${demoUser.email} already exists, updating password`)
        userId = userExists.id
        
        // Update password
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: demoUser.password
        })
      } else {
        console.log(`Creating user ${demoUser.email}`)
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: demoUser.email,
          password: demoUser.password,
          email_confirm: true
        })

        if (createError) throw createError
        userId = newUser.user.id
      }

      // Upsert profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: userId,
          user_type: demoUser.user_type,
          ...demoUser.profile,
          is_active: true
        }, {
          onConflict: 'user_id'
        })

      if (profileError) throw profileError

      // Handle roles
      if (demoUser.roles.length > 0) {
        // Delete existing roles
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId)

        // Insert new roles
        for (const role of demoUser.roles) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: userId,
              role: role
            })

          if (roleError && roleError.code !== '23505') { // Ignore duplicate key errors
            throw roleError
          }
        }
      }

      results.push({
        email: demoUser.email,
        status: 'success',
        userId
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Demo users seeded successfully',
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error seeding demo users:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
