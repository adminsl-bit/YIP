import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StudentPhoto {
  id: string;
  serial_number: number;
  name: string;
  photo_url: string;
}

// Background migration function
async function performMigration() {
  try {
    console.log('Starting background migration...');
    
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

    // Get students with Google Drive photos
    const { data: students, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, serial_number, name, photo_url')
      .eq('user_type', 'student')
      .like('photo_url', '%drive.google.com%');

    if (fetchError) {
      console.error('Failed to fetch students:', fetchError.message);
      return;
    }

    if (!students || students.length === 0) {
      console.log('No Google Drive photos found to migrate');
      return;
    }

    console.log(`Starting migration for ${students.length} students`);
    let success = 0;
    let failed = 0;

    for (const student of students as StudentPhoto[]) {
      try {
        console.log(`Processing ${student.name} (${student.serial_number})`);
        
        // Convert Google Drive URL to direct download format
        let downloadUrl = student.photo_url;
        if (downloadUrl.includes('/file/d/')) {
          const fileId = downloadUrl.split('/d/')[1]?.split('/')[0];
          downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        } else if (downloadUrl.includes('uc?export=view&id=')) {
          downloadUrl = downloadUrl.replace('uc?export=view&id=', 'uc?export=download&id=');
        }

        console.log(`Downloading from: ${downloadUrl}`);

        // Download the image with proper headers
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const imageBlob = await response.blob();
        console.log(`Downloaded ${imageBlob.size} bytes for ${student.name}`);

        if (imageBlob.size === 0) {
          throw new Error('Downloaded file is empty');
        }

        // Convert blob to File for upload
        const fileName = `${student.serial_number}.jpg`;
        const imageFile = new File([imageBlob], fileName, { type: 'image/jpeg' });

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('student-photos')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg'
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        console.log(`Uploaded ${fileName} to storage`);

        // Get the public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('student-photos')
          .getPublicUrl(fileName);

        // Update the photo_url in database
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ photo_url: publicUrl })
          .eq('id', student.id);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        success++;
        console.log(`✅ Successfully migrated ${student.name}`);

      } catch (error) {
        failed++;
        console.error(`❌ Failed to migrate ${student.name}:`, error);
      }
    }

    console.log(`Migration completed: ${success} success, ${failed} failed`);
  } catch (error) {
    console.error('Background migration error:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client to check for pending migrations
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

    // Quick check for Google Drive photos
    const { data: students, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_type', 'student')
      .like('photo_url', '%drive.google.com%');

    if (fetchError) {
      throw new Error(`Failed to fetch students: ${fetchError.message}`);
    }

    const count = students?.length || 0;

    if (count === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No Google Drive photos found to migrate',
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Start the migration in the background
    EdgeRuntime.waitUntil(performMigration());

    // Return immediately
    return new Response(JSON.stringify({
      success: true,
      message: `Migration started for ${count} photos`,
      total: count,
      note: 'Migration is running in the background. Check the function logs for progress.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in migrate-photos function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});