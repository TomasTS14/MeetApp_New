-- Run with: supabase test db
-- Covers the checks on profile songs and what "Download my data" returns.
begin;
select plan(8);

delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com');
insert into public.profiles (id, username, confirmed_minimum_age) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', true),
  ('00000000-0000-0000-0000-00000000000b', 'bob', true);
insert into public.events (id, organizer_id, title, starts_at, location, address, area_label) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', 'Bob''s paella',
   now() + interval '2 days', 'SRID=4326;POINT(-0.3763 39.4699)', 'Calle Mayor 1', 'Russafa, Valencia');
insert into public.event_aliases (id, event_id, user_id, alias) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-00000000000a', 'Quiet Otter');
-- Bob's organizer alias is created with the event.
insert into public.comments (event_id, alias_id, body) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Can I bring a friend?'),
  ('00000000-0000-0000-0000-0000000000e1',
   (select id from public.event_aliases where user_id = '00000000-0000-0000-0000-00000000000b'), 'Yes, of course');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.profile_songs (profile_id, position, spotify_url, title, artwork_url) values
    ('00000000-0000-0000-0000-00000000000a', 0, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
     'Never Gonna Give You Up', 'https://i.scdn.co/image/ab67616d00001e02abc')$$,
  'Alice adds a Spotify track with Spotify artwork'
);
select throws_ok(
  $$insert into public.profile_songs (profile_id, position, spotify_url) values
    ('00000000-0000-0000-0000-00000000000a', 1, 'https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT')$$,
  '23514', null,
  'only track links are accepted'
);
select throws_ok(
  $$insert into public.profile_songs (profile_id, position, spotify_url, artwork_url) values
    ('00000000-0000-0000-0000-00000000000a', 1, 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
     'https://tracker.example/pixel.png')$$,
  '23514', null,
  'artwork has to come from Spotify'
);
select throws_ok(
  $$insert into public.profile_songs (profile_id, position, spotify_url) values
    ('00000000-0000-0000-0000-00000000000a', 1, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')$$,
  '23505', null,
  'the same track cannot be added twice'
);

select is(
  public.export_my_data() -> 'profile' ->> 'username',
  'alice',
  'the export holds the caller''s own profile'
);
select is(
  jsonb_array_length(public.export_my_data() -> 'songs'),
  1,
  'the export lists the caller''s songs'
);
select is(
  (select jsonb_agg(c ->> 'body') from jsonb_array_elements(public.export_my_data() -> 'comments') c),
  '["Can I bring a friend?"]'::jsonb,
  'the export holds the caller''s own comments and nobody else''s'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.export_my_data()$$,
  '42501', null,
  'signed-out visitors cannot call the export'
);

select * from finish();
rollback;
