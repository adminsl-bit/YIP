import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// facebook/bart-large-cnn has a ~1024 token input limit (~4 chars/token average).
const MAX_INPUT_CHARS = 4000;
const HF_MODEL = 'facebook/bart-large-cnn';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hfToken = Deno.env.get('HUGGINGFACE_API_KEY');
    if (!hfToken) throw new Error('AI summary is not configured on the server.');

    const { text } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('No document text provided.');
    }

    const input = text.replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT_CHARS);

    const response = await fetch(`https://router.huggingface.co/hf-inference/models/${HF_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: input,
        parameters: { max_length: 180, min_length: 40, do_sample: false },
        options: { wait_for_model: true },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      const message = typeof result?.error === 'string' ? result.error : 'AI summary request failed.';
      throw new Error(message);
    }

    const summary = Array.isArray(result) ? result[0]?.summary_text : result?.summary_text;
    if (!summary) throw new Error('AI summary returned an empty result.');

    return new Response(JSON.stringify({ success: true, summary: summary.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
