// Lets an admin ban the person behind a reported comment, event, update or profile, and
// remove the reported thing in the same step. The app sends only the report target; the
// author is looked up here. A banned person cannot sign in or refresh their session.
import { asAdmin, asCaller, callerId, corsHeaders, fail } from '../_shared/http.ts';

const TARGET_TYPES = ['user', 'event', 'event_update', 'comment'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);

  if (!(await callerId(req))) return fail('not_signed_in', 401);
  const caller = asCaller(req);
  const isAdmin = await caller('/rest/v1/rpc/is_admin', { method: 'POST', body: '{}' });
  if (!isAdmin.ok || (await isAdmin.json()) !== true) return fail('admins_only', 403);

  const { target_type: targetType, target_id: targetId, remove } = await req.json().catch(() => ({}));
  if (!TARGET_TYPES.includes(targetType) || typeof targetId !== 'string') return fail('bad_request', 400);

  // admin_reports() is admin-only and already resolves each target's author.
  const queue = await caller('/rest/v1/rpc/admin_reports', { method: 'POST', body: '{}' });
  if (!queue.ok) return fail('server_error', 500);
  const rows: { target_type: string; target_id: string; author_id: string | null }[] = await queue.json();
  const authorId = rows.find((row) => row.target_type === targetType && row.target_id === targetId)?.author_id;
  if (!authorId) return fail('not_found', 404);

  const ban = await asAdmin()(`/auth/v1/admin/users/${authorId}`, {
    method: 'PUT',
    body: JSON.stringify({ ban_duration: '876000h' }),
  });
  if (!ban.ok) return fail('server_error', 500);

  const resolve = (type: string, id: string, resolution: string) =>
    caller('/rest/v1/rpc/admin_resolve_reports', {
      method: 'POST',
      body: JSON.stringify({ p_target_type: type, p_target: id, p_resolution: resolution }),
    });

  if (remove === true && targetType !== 'user') {
    if (!(await resolve(targetType, targetId, 'removed')).ok) return fail('server_error', 500);
  }
  // Every other open report about this person or what they wrote is now handled.
  for (const row of rows.filter((row) => row.author_id === authorId)) {
    if (remove === true && row.target_type === targetType && row.target_id === targetId) continue;
    if (!(await resolve(row.target_type, row.target_id, 'banned')).ok) return fail('server_error', 500);
  }
  return new Response(null, { status: 204, headers: corsHeaders });
});
