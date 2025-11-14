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

    // Verify the requesting user is an organizer
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is an organizer
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.user_type !== 'organizer') {
      throw new Error('Only organizers can reset passwords')
    }

    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword) {
      throw new Error('User ID and new password are required')
    }

    // Verify the target user is a student
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('user_type, name')
      .eq('user_id', userId)
      .single()

    if (targetProfileError) {
      throw new Error('Student not found')
    }

    if (targetProfile.user_type !== 'student') {
      throw new Error('Can only reset passwords for students')
    }

    // Reset the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      throw new Error(`Failed to reset password: ${updateError.message}`)
    }

    console.log(`Password reset for student ${targetProfile.name} by organizer ${user.id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Password reset successfully for ${targetProfile.name}` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in reset-student-password function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
