// Deletes the caller's account for good: their photos in storage first, then the auth
// user, which cascades to every row about them (profile, events, answers, aliases and
// comments, friendships, settings).
import { asAdmin, callerId, corsHeaders, fail } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);

  const userId = await callerId(req);
  if (!userId) return fail('not_signed_in', 401);

  const admin = asAdmin();

  const eventsResponse = await admin(`/rest/v1/events?select=id&organizer_id=eq.${userId}`);
  if (!eventsResponse.ok) return fail('server_error', 500);
  const events: { id: string }[] = await eventsResponse.json();

  // Photos live under <event id>/ and avatars under <user id>/.
  const folders: [bucket: string, folder: string][] = [
    ['avatars', userId],
    ...events.map((event): [string, string] => ['event-photos', event.id]),
  ];
  for (const [bucket, folder] of folders) {
    const list = await admin(`/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      body: JSON.stringify({ prefix: `${folder}/`, limit: 1000 }),
    });
    if (!list.ok) return fail('server_error', 500);
    const files: { name: string }[] = await list.json();
    if (files.length === 0) continue;
    const remove = await admin(`/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: files.map((file) => `${folder}/${file.name}`) }),
    });
    if (!remove.ok) return fail('server_error', 500);
  }

  const deleted = await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
  if (!deleted.ok) return fail('server_error', 500);
  return new Response(null, { status: 204, headers: corsHeaders });
});
