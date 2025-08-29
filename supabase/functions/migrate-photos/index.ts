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

// Background migration functions: batch and full-run
async function performMigrationBatch(batchSize = 5) {
  try {
    console.log('Starting migration batch...');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: students, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, serial_number, name, photo_url')
      .eq('user_type', 'student')
      .like('photo_url', '%drive.google.com%')
      .limit(batchSize);

    if (fetchError) {
      console.error('Failed to fetch students:', fetchError.message);
      return { success: false, processed: 0 };
    }

    if (!students || students.length === 0) {
      console.log('No Google Drive photos found to migrate in this batch');
      return { success: true, processed: 0 };
    }

    console.log(`Starting migration batch for ${students.length} students`);
    let success = 0;
    let failed = 0;

    const promises = students.map(async (student: StudentPhoto) => {
      try {
        console.log(`Processing ${student.name} (${student.serial_number})`);
        let downloadUrl = student.photo_url;
        if (downloadUrl.includes('/file/d/')) {
          const fileId = downloadUrl.split('/d/')[1]?.split('/')[0];
          downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        } else if (downloadUrl.includes('uc?export=view&id=')) {
          downloadUrl = downloadUrl.replace('uc?export=view&id=', 'uc?export=download&id=');
        }

        console.log(`Downloading from: ${downloadUrl}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(downloadUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const imageBlob = await response.blob();
        console.log(`Downloaded ${imageBlob.size} bytes for ${student.name}`);
        if (imageBlob.size === 0) throw new Error('Downloaded file is empty');

        const fileName = `${student.serial_number}.jpg`;
        const imageFile = new File([imageBlob], fileName, { type: 'image/jpeg' });

        const { error: uploadError } = await supabaseAdmin.storage
          .from('student-photos')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg'
          });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        console.log(`Uploaded ${fileName} to storage`);

        // Use plain public URL to maximize compatibility
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('student-photos')
          .getPublicUrl(fileName);
        const finalUrl = `${publicUrl}?v=${Date.now()}`;

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ photo_url: finalUrl })
          .eq('id', student.id);
        if (updateError) throw new Error(`Database update failed: ${updateError.message}`);

        return { success: true, student: student.name };
      } catch (error) {
        console.error(`❌ Failed to migrate ${student.name}:`, error);
        return { success: false, student: student.name, error: (error as Error).message };
      }
    });

    const results = await Promise.allSettled(promises);
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        success++;
        console.log(`✅ Successfully migrated ${result.value.student}`);
      } else {
        failed++;
        if (result.status === 'fulfilled') {
          console.error(`❌ Failed to migrate ${result.value.student}: ${result.value.error}`);
        } else {
          console.error('❌ Promise rejected:', result.reason);
        }
      }
    });

    console.log(`Migration batch completed: ${success} success, ${failed} failed`);
    return { success: true, processed: success };
  } catch (error) {
    console.error('Background migration batch error:', error);
    return { success: false, processed: 0 };
  }
}

async function performFullMigration() {
  console.log('Starting full migration in background...');
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Keep processing until no Google Drive photos remain or safety cap hit
  let safetyBatches = 0;
  while (true) {
    const { data: remainingRows, error: countError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_type', 'student')
      .like('photo_url', '%drive.google.com%');

    if (countError) {
      console.error('Count check failed:', countError.message);
      break;
    }

    const remaining = remainingRows?.length ?? 0;
    console.log(`Remaining to migrate: ${remaining}`);

    if (remaining === 0) {
      console.log('Full migration complete.');
      break;
    }

    await performMigrationBatch(5);
    safetyBatches++;
    if (safetyBatches > 500) {
      console.warn('Safety stop: too many batches.');
      break;
    }

    await delay(1000); // small pause between batches
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

    // Start full migration in the background (will auto-batch to avoid timeouts)
    EdgeRuntime.waitUntil(performFullMigration());

    // Return immediately
    return new Response(JSON.stringify({
      success: true,
      message: 'Full migration started in background',
      total_remaining: count,
      note: 'Processing automatically in small batches until complete.'
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