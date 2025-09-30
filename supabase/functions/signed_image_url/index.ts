import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SignedUrlRequest {
  imagePath: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response('Missing Authorization header', { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const jwt = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response('Invalid authorization token', { status: 401, headers: corsHeaders });
    }

    const { imagePath }: SignedUrlRequest = await req.json();

    // Verify the image path belongs to the authenticated user
    if (!imagePath.startsWith(`${user.id}/`)) {
      return new Response('Unauthorized access to image', { status: 403, headers: corsHeaders });
    }

    // Generate signed URL valid for 60 seconds
    const { data: signedUrlData, error: urlError } = await supabaseClient
      .storage
      .from('receipts')
      .createSignedUrl(imagePath, 60);

    if (urlError || !signedUrlData) {
      return new Response('Failed to generate signed URL', { status: 500, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ signedUrl: signedUrlData.signedUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Signed URL error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});