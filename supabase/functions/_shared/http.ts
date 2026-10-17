// Small helpers for the edge functions. They call Supabase's REST, auth and storage
// APIs with fetch, so the functions have no dependencies to download.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// An error the app shows by its code, e.g. { error: 'not_a_track' }.
export function fail(error: string, status: number) {
  return json({ error }, status);
}

const baseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export type Api = (path: string, init?: RequestInit) => Promise<Response>;

function api(apikey: string, authorization: string): Api {
  return (path, init = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { apikey, Authorization: authorization, 'Content-Type': 'application/json', ...init.headers },
    });
}

// Acts as the caller, so row level security applies exactly as in the app.
export function asCaller(req: Request): Api {
  return api(anonKey, req.headers.get('Authorization') ?? '');
}

// Bypasses row level security. Only for steps the caller cannot do themselves.
export function asAdmin(): Api {
  return api(serviceKey, `Bearer ${serviceKey}`);
}

export async function callerId(req: Request): Promise<string | null> {
  if (!req.headers.get('Authorization')) return null;
  const response = await asCaller(req)('/auth/v1/user');
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.id === 'string' ? user.id : null;
}
