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

    // Get all student profiles for this organizer's event only
    let studentsQuery = supabaseClient
      .from('profiles')
      .select('user_id, name, serial_number')
      .eq('user_type', 'student');

    studentsQuery = profile.event_id
      ? studentsQuery.eq('event_id', profile.event_id)
      : studentsQuery.is('event_id', null);

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      throw studentsError;
    }

    if (!students || students.length === 0) {
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

    // Delete each student's auth account (this will cascade to profiles and related data)
    for (const student of students) {
      try {
        console.log(`Deleting student: ${student.name} (${student.serial_number})`);
        
        const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(
          student.user_id
        );

        if (deleteError) {
          console.error(`Error deleting student ${student.serial_number}:`, deleteError);
          errors.push({
            student: student.name,
            serial_number: student.serial_number,
            error: deleteError.message
          });
        } else {
          deletedCount++;
          console.log(`Successfully deleted student ${student.serial_number}`);
        }
      } catch (error) {
        console.error(`Exception deleting student ${student.serial_number}:`, error);
        errors.push({
          student: student.name,
          serial_number: student.serial_number,
          error: error.message
        });
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
