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
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { loginId, password, resetToken } = await req.json()

    if (!loginId || !password || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Login ID and a password of at least 6 characters are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const email = `${loginId.toLowerCase().trim()}@yip-parliament.com`

    // Check if a super_admin profile already exists
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('user_id, name')
      .eq('user_type', 'super_admin')
      .maybeSingle()

    if (existing) {
      // RESET mode — require reset token
      const envToken = Deno.env.get('ADMIN_RESET_TOKEN') ?? 'YIP-RESET-2026'
      if (!resetToken || resetToken.trim() !== envToken) {
        return new Response(JSON.stringify({
          error: 'A super admin already exists. Provide the correct reset token to update credentials.',
          requiresToken: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 })
      }

      // Update auth password
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.user_id, {
        password,
        email,
        email_confirm: true,
      })
      if (updateErr) throw new Error(`Auth update failed: ${updateErr.message}`)

      // Update profile email/name
      await supabaseAdmin.from('profiles').update({ email, name: loginId }).eq('user_id', existing.user_id)

      return new Response(JSON.stringify({ success: true, action: 'reset', loginId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    // CREATE mode — no existing super admin, first-time setup
    // Check if auth user with this email exists
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingAuthUser = usersList?.users?.find((u: any) =>
      u.email?.toLowerCase() === email.toLowerCase()
    )

    let userId: string

    if (existingAuthUser) {
      // Update existing auth user password
      await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, { password, email_confirm: true })
      userId = existingAuthUser.id
    } else {
      // Create new auth user
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (authErr) throw new Error(`Auth creation failed: ${authErr.message}`)
      userId = authData.user!.id
    }

    // Upsert profile with super_admin user_type
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      user_id: userId,
      name: loginId,
      email,
      user_type: 'super_admin',
      position: 'Super Administrator',
      serial_number: 1,
      party_number: 0,
      is_active: true,
    }, { onConflict: 'user_id' })

    if (profileErr) throw new Error(`Profile upsert failed: ${profileErr.message}`)

    return new Response(JSON.stringify({ success: true, action: 'created', loginId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err) {
    console.error('setup-super-admin error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
