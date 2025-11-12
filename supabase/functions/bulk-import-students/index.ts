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
  alliance?: string;
  party?: string;
  partyName?: string;
  committee?: string;
  constituency?: string;
  state?: string;
  city?: string;
  password: string;
  preeventScores?: number;
}

function convertGoogleDriveUrl(url: string): string {
  if (!url) return url;
  
  // Convert Google Drive sharing URL to direct download URL
  const driveMatch = url.match(/(?:drive\.google\.com\/(?:file\/d\/|uc\?id=))([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  
  return url;
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
        // Determine role based on seat role
        const seatRoleLower = student.seatRole.toLowerCase();
        const isAdmin = seatRoleLower.includes('administrator');
        const isJournalist = seatRoleLower.includes('journalist');
        
        // Determine party number from party letter (A=1, B=2, C=3, D=4, E=5)
        const partyMap: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
        
        // Normalize and validate party input. Accepts: "A", "Party A", "A - ...", or "No Party"
        const rawParty = (student.party ?? '').toString().trim().toUpperCase();
        let partyNumber = 0;
        
        if (!rawParty) {
          results.errors.push(`${student.name}: Missing party value. Use A-E or "No Party".`);
          results.failed++;
          continue;
        }
        
        // Check if it's "No Party"
        if (rawParty === 'NO PARTY' || rawParty === 'NOPARTY') {
          partyNumber = 0; // No party = 0
        } else {
          // Try to extract party letter A-E
          const match = rawParty.match(/\b([A-E])\b/);
          const letter = match ? match[1] : (rawParty.length === 1 ? rawParty : '');
          if (!letter || !partyMap[letter]) {
            results.errors.push(`${student.name}: Invalid party value "${student.party}". Use A-E or "No Party".`);
            results.failed++;
            continue;
          }
          partyNumber = partyMap[letter];
        }

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
            { password: student.password, email: `${student.loginId}@yip.parliament`, email_confirm: true }
          );

          if (updateAuthError) {
            results.errors.push(`${student.name}: Failed to update password - ${updateAuthError.message}`);
            results.failed++;
            continue;
          }

          userId = existingProfile.user_id;

          // Update existing profile
          const updateData: any = {
            name: student.name,
            position: student.seatRole,
            party_number: partyNumber,
            party_name: student.partyName,
            committee: student.committee,
            constituency: student.constituency,
            state: student.state,
            city: student.city,
            email: `${student.loginId}@yip.parliament`,
            user_type: 'student',
          };

          // Only update preevent_scores if provided
          if (student.preeventScores !== undefined && student.preeventScores !== null) {
            updateData.preevent_scores = student.preeventScores;
          }

          const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('user_id', existingProfile.user_id);

          if (updateProfileError) {
            results.errors.push(`${student.name}: Failed to update profile - ${updateProfileError.message}`);
            results.failed++;
            continue;
          }

          // Update roles
          await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

          if (isAdmin) {
            await supabaseAdmin
              .from('user_roles')
              .insert({ user_id: userId, role: 'admin_student' });
          }

          if (isJournalist) {
            await supabaseAdmin
              .from('user_roles')
              .insert({ user_id: userId, role: 'journalist' });
          }

        } else {
          // Create new user account
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
             email: `${student.loginId}@yip.parliament`,
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
          const profileData: any = {
            user_id: authData.user.id,
            serial_number: student.serialNumber,
            name: student.name,
            position: student.seatRole,
            party_number: partyNumber,
            party_name: student.partyName,
            committee: student.committee,
            constituency: student.constituency,
            state: student.state,
            city: student.city,
            user_type: 'student',
            email: `${student.loginId}@yip.parliament`,
          };

          // Only add preevent_scores if provided
          if (student.preeventScores !== undefined && student.preeventScores !== null) {
            profileData.preevent_scores = student.preeventScores;
          }

          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert(profileData);

          if (profileError) {
            results.errors.push(`${student.name}: Failed to create profile - ${profileError.message}`);
            results.failed++;
            continue;
          }

          // Assign roles
          if (isAdmin) {
            await supabaseAdmin
              .from('user_roles')
              .insert({ user_id: userId, role: 'admin_student' });
          }

          if (isJournalist) {
            await supabaseAdmin
              .from('user_roles')
              .insert({ user_id: userId, role: 'journalist' });
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