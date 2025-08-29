import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StudentData {
  serialNumber: number;
  loginId: string;
  name: string;
  seatRole: string;
  partyNumber: number;
  constituency?: string;
  state?: string;
  city?: string;
  photoUrl?: string;
  password: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { students } = await req.json();
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const student of students as StudentData[]) {
      try {
        // Check if user already exists
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('serial_number', student.serialNumber)
          .single();

        let userId: string;

        if (existingProfile) {
          // Update existing user password
          const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
            existingProfile.user_id,
            { password: student.password }
          );

          if (updateAuthError) {
            results.errors.push(`${student.name}: Failed to update password - ${updateAuthError.message}`);
            results.failed++;
            continue;
          }

          userId = existingProfile.user_id;

          // Update existing profile
          const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .update({
              name: student.name,
              position: student.seatRole,
              party_number: student.partyNumber,
              constituency: student.constituency,
              state: student.state,
              city: student.city,
              photo_url: student.photoUrl,
              email: `${student.loginId}@parliament.local`,
            })
            .eq('user_id', existingProfile.user_id);

          if (updateProfileError) {
            results.errors.push(`${student.name}: Failed to update profile - ${updateProfileError.message}`);
            results.failed++;
            continue;
          }
        } else {
          // Create new user account
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: `${student.loginId}@parliament.local`,
            password: student.password,
            email_confirm: true,
          });

          if (authError) {
            results.errors.push(`${student.name}: Failed to create auth user - ${authError.message}`);
            results.failed++;
            continue;
          }

          userId = authData.user.id;

          // Create new profile
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              user_id: authData.user.id,
              serial_number: student.serialNumber,
              name: student.name,
              position: student.seatRole,
              party_number: student.partyNumber,
              constituency: student.constituency,
              state: student.state,
              city: student.city,
              photo_url: student.photoUrl,
              user_type: 'student',
              email: `${student.loginId}@parliament.local`,
            });

          if (profileError) {
            results.errors.push(`${student.name}: Failed to create profile - ${profileError.message}`);
            results.failed++;
            continue;
          }
        }

        results.success++;
      } catch (error) {
        results.errors.push(`${student.name}: Unexpected error - ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.failed++;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in bulk-import-students function:', error);
    return new Response(JSON.stringify({ 
      success: 0, 
      failed: 0, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});