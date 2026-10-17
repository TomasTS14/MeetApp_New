// Adds a Spotify track to the caller's profile. The app sends the link the person
// pasted; this looks it up with Spotify's public oEmbed endpoint (no Spotify login)
// and stores the title and artwork next to the canonical track link.
import { asCaller, callerId, corsHeaders, fail, json } from '../_shared/http.ts';

const MAX_SONGS = 10;
const OEMBED_URL = Deno.env.get('SPOTIFY_OEMBED_URL') ?? 'https://open.spotify.com/oembed';
const ARTWORK_HOST = /^https:\/\/([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com)\//;

// Accepts open.spotify.com/track/<id> (with or without an intl-xx segment or query
// string) and spotify:track:<id>.
export function trackId(input: string): string | null {
  const text = input.trim();
  const uri = text.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];
  try {
    const url = new URL(text);
    if (url.hostname !== 'open.spotify.com') return null;
    const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})\/?$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);

  const userId = await callerId(req);
  if (!userId) return fail('not_signed_in', 401);

  const { url } = await req.json().catch(() => ({ url: null }));
  const id = typeof url === 'string' ? trackId(url) : null;
  if (!id) return fail('not_a_track', 400);
  const spotifyUrl = `https://open.spotify.com/track/${id}`;

  const api = asCaller(req);
  const read = await api(`/rest/v1/profile_songs?select=position,spotify_url&profile_id=eq.${userId}`);
  if (!read.ok) return fail('server_error', 500);
  const existing: { position: number; spotify_url: string }[] = await read.json();
  if (existing.some((song) => song.spotify_url === spotifyUrl)) return fail('already_added', 409);
  const used = new Set(existing.map((song) => song.position));
  const position = Array.from({ length: MAX_SONGS }, (_, i) => i).find((i) => !used.has(i));
  if (position === undefined) return fail('too_many_songs', 409);

  const lookup = await fetch(`${OEMBED_URL}?url=${encodeURIComponent(spotifyUrl)}`).catch(() => null);
  if (!lookup || lookup.status === 404 || lookup.status === 400) return fail('song_not_found', 404);
  if (!lookup.ok) return fail('spotify_unavailable', 502);
  const info = await lookup.json().catch(() => null);
  if (!info?.title) return fail('song_not_found', 404);

  const artwork = typeof info.thumbnail_url === 'string' && ARTWORK_HOST.test(info.thumbnail_url)
    ? info.thumbnail_url
    : null;

  const insert = await api('/rest/v1/profile_songs?select=position,spotify_url,title,artist,artwork_url', {
    method: 'POST',
    headers: { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' },
    body: JSON.stringify({
      profile_id: userId,
      position,
      spotify_url: spotifyUrl,
      title: String(info.title).slice(0, 300),
      artwork_url: artwork,
    }),
  });
  if (!insert.ok) {
    // Two adds at once can race for the same slot; the app can simply try again.
    const error = await insert.json().catch(() => null);
    return error?.code === '23505' ? fail('try_again', 409) : fail('server_error', 500);
  }
  return json(await insert.json(), 201);
});
