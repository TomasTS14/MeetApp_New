-- Phase 4: Spotify songs on profiles, and "Download my data".

-- Songs are added through the spotify-song edge function, which looks the link up on
-- Spotify. These checks keep a hand-made row from pointing the profile at any other site.
alter table public.profile_songs
  add constraint profile_songs_track_url
    check (spotify_url ~ '^https://open\.spotify\.com/track/[A-Za-z0-9]{22}$'),
  add constraint profile_songs_artwork_host
    check (artwork_url is null or artwork_url ~ '^https://([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com)/'),
  add constraint profile_songs_title_length
    check (title is null or char_length(title) <= 300),
  add constraint profile_songs_artist_length
    check (artist is null or char_length(artist) <= 300),
  add constraint profile_songs_unique_track unique (profile_id, spotify_url);

-- Everything MeetApp holds about the signed-in person, as one JSON document (GDPR
-- right of access). Comments are found through the person's own aliases; other
-- people's data is left out.
create function public.export_my_data()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at)
                from auth.users u where u.id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'settings', (select to_jsonb(s) - 'user_id' from public.user_settings s where s.user_id = auth.uid()),
    'songs', coalesce((select jsonb_agg(to_jsonb(s) - 'profile_id' order by s.position)
                       from public.profile_songs s where s.profile_id = auth.uid()), '[]'),
    'friendships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', other.username,
        'status', f.status,
        'sent_by_you', f.requester_id = auth.uid(),
        'created_at', f.created_at) order by f.created_at)
      from public.friendships f
      join public.profiles other
        on other.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
      where auth.uid() in (f.requester_id, f.addressee_id)), '[]'),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'created_at', b.created_at))
      from public.blocks b join public.profiles p on p.id = b.blocked_id
      where b.blocker_id = auth.uid()), '[]'),
    'events_organized', coalesce((
      select jsonb_agg((to_jsonb(e) - 'location' - 'organizer_id') || jsonb_build_object(
        'latitude', extensions.st_y(e.location::extensions.geometry),
        'longitude', extensions.st_x(e.location::extensions.geometry),
        'photos', coalesce((select jsonb_agg(ph.storage_path order by ph.position)
                            from public.event_photos ph where ph.event_id = e.id), '[]'),
        'updates', coalesce((select jsonb_agg(jsonb_build_object('body', u.body, 'created_at', u.created_at)
                                              order by u.created_at)
                             from public.event_updates u where u.event_id = e.id), '[]'))
        order by e.starts_at)
      from public.events e where e.organizer_id = auth.uid()), '[]'),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', r.event_id, 'event_title', e.title, 'status', r.status,
        'created_at', r.created_at, 'updated_at', r.updated_at) order by r.created_at)
      from public.rsvps r join public.events e on e.id = r.event_id
      where r.user_id = auth.uid()), '[]'),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', c.event_id, 'event_title', e.title, 'alias', a.alias,
        'body', c.body, 'created_at', c.created_at, 'deleted_at', c.deleted_at) order by c.created_at)
      from public.event_aliases a
      join public.comments c on c.alias_id = a.id
      join public.events e on e.id = c.event_id
      where a.user_id = auth.uid()), '[]'),
    'reports_sent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'target_type', r.target_type, 'reason', r.reason, 'created_at', r.created_at) order by r.created_at)
      from public.reports r where r.reporter_id = auth.uid()), '[]')
  )
  where auth.uid() is not null;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
