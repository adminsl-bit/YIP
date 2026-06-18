import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the request is from an organizer
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is an organizer
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('user_type, event_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.user_type !== 'organizer') {
      throw new Error('Only organizers can delete students');
    }

    console.log(`Starting deletion of all students for event ${profile.event_id ?? '(none)'}...`);

    // Collect students to delete:
    // 1. Students belonging to this organizer's event
    // 2. Students with no event assigned (orphans from failed bulk imports),
    //    created within the last 7 days — prevents accumulation of ghost accounts
    const toDeleteIds = new Set<string>();

    if (profile.event_id) {
      const { data: eventStudents } = await supabaseClient
        .from('profiles')
        .select('user_id')
        .eq('user_type', 'student')
        .eq('event_id', profile.event_id);
      (eventStudents ?? []).forEach((s: any) => toDeleteIds.add(s.user_id));

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: orphans } = await supabaseClient
        .from('profiles')
        .select('user_id')
        .eq('user_type', 'student')
        .is('event_id', null)
        .gte('created_at', since);
      (orphans ?? []).forEach((s: any) => toDeleteIds.add(s.user_id));
    } else {
      const { data: nullEventStudents } = await supabaseClient
        .from('profiles')
        .select('user_id')
        .eq('user_type', 'student')
        .is('event_id', null);
      (nullEventStudents ?? []).forEach((s: any) => toDeleteIds.add(s.user_id));
    }

    const students = [...toDeleteIds].map(user_id => ({ user_id }));

    if (students.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No students found to delete',
          deleted_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${students.length} students to delete`);

    let deletedCount = 0;
    const errors = [];

    // Delete each student's auth account (cascades to profiles and related data)
    for (const student of students) {
      try {
        const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(student.user_id);
        if (deleteError) {
          errors.push({ user_id: student.user_id, error: deleteError.message });
        } else {
          deletedCount++;
        }
      } catch (error) {
        errors.push({ user_id: student.user_id, error: error.message });
      }
    }

    console.log(`Deletion complete. Deleted ${deletedCount} out of ${students.length} students`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully deleted ${deletedCount} students`,
        deleted_count: deletedCount,
        total_students: students.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in delete-all-students function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
