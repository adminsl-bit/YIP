import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RoleUserConfig {
  roleType: 'jury' | 'admin' | 'journalist';
  count: number;
  password: string;
}

interface RoleDefinition {
  userType: 'jury' | 'student';
  appRole?: 'admin_student' | 'journalist';
  position: string;
  serialStart: number;
  emailDomain: string;
  namePrefix: string;
}

const roleDefinitions: Record<string, RoleDefinition> = {
  jury: {
    userType: 'jury',
    position: 'Senior Evaluator',
    serialStart: 1001,
    emailDomain: '@yip.com',
    namePrefix: 'Jury',
  },
  admin: {
    userType: 'student',
    appRole: 'admin_student',
    position: 'Admin Student',
    serialStart: 9001,
    emailDomain: '@yip.com',
    namePrefix: 'Admin',
  },
  journalist: {
    userType: 'student',
    appRole: 'journalist',
    position: 'Journalist',
    serialStart: 8001,
    emailDomain: '@yip.com',
    namePrefix: 'Journalist',
  },
};

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

    const { roleType, count, password }: RoleUserConfig = await req.json();

    console.log(`Creating ${count} ${roleType} users with password: ${password}`);

    if (!roleType || !roleDefinitions[roleType]) {
      throw new Error(`Invalid role type: ${roleType}`);
    }

    if (count < 1 || count > 50) {
      throw new Error('Count must be between 1 and 50');
    }

    const roleDef = roleDefinitions[roleType];
    const results = []

    for (let i = 1; i <= count; i++) {
      const userEmail = `${roleType}${i}${roleDef.emailDomain}`;
      const userName = `${roleDef.namePrefix} ${i}`;
      const serialNumber = roleDef.serialStart + i - 1;

      try {
        // Check if profile already exists
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('email', userEmail)
          .single();

        if (existingProfile?.user_id) {
          const userId = existingProfile.user_id as string;

          // Update existing user
          const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: password,
            email: userEmail,
            email_confirm: true,
          });
          if (updateAuthError) throw new Error(`Auth update failed: ${updateAuthError.message}`);

          const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .update({
              name: userName,
              position: roleDef.position,
              serial_number: serialNumber,
              party_number: 0,
              user_type: roleDef.userType,
              email: userEmail,
            })
            .eq('user_id', userId);
          if (updateProfileError) throw new Error(`Profile update failed: ${updateProfileError.message}`);

          // Update role if needed
          if (roleDef.appRole) {
            const { data: existingRole } = await supabaseAdmin
              .from('user_roles')
              .select('id')
              .eq('user_id', userId)
              .eq('role', roleDef.appRole)
              .single();

            if (!existingRole) {
              await supabaseAdmin
                .from('user_roles')
                .insert({
                  user_id: userId,
                  role: roleDef.appRole,
                });
            }
          }

          console.log(`Updated ${userEmail}`);
          results.push({ email: userEmail, success: true, action: 'updated' });
          continue;
        }

        // Create new auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          password: password,
          email_confirm: true,
        });

        let userId = authData?.user?.id as string | undefined;

        // If email already exists in auth but not in profiles, find the user
        if (authError) {
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = usersList?.users?.find((u: any) => u.email?.toLowerCase() === userEmail.toLowerCase());
          if (!existing) {
            throw new Error(`Failed to create or find user: ${authError.message}`);
          }
          userId = existing.id;
        }

        if (!userId) {
          throw new Error('No user ID available');
        }

        // Create profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: userId,
            name: userName,
            position: roleDef.position,
            serial_number: serialNumber,
            party_number: 0,
            user_type: roleDef.userType,
            email: userEmail,
          });

        if (profileError) {
          throw new Error(`Profile creation failed: ${profileError.message}`);
        }

        // Assign app role if needed
        if (roleDef.appRole) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: userId,
              role: roleDef.appRole,
            });

          if (roleError) {
            throw new Error(`Role assignment failed: ${roleError.message}`);
          }
        }

        console.log(`Created ${userEmail}`);
        results.push({ email: userEmail, success: true, action: 'created' });
      } catch (error) {
        console.error(`Error processing ${userEmail}:`, error);
        results.push({ 
          email: userEmail, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in create-role-users function:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
