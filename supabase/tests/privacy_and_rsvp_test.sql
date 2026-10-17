-- Run with: supabase test db
-- Covers the privacy promises in docs/privacy.md and the waitlist rules.
begin;
select plan(38);

-- Four people: Alice organizes, Bob, Carol and Dave take part.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com');
insert into public.profiles (id, username) values
  ('00000000-0000-0000-0000-00000000000a', 'alice'),
  ('00000000-0000-0000-0000-00000000000b', 'bob'),
  ('00000000-0000-0000-0000-00000000000c', 'carol'),
  ('00000000-0000-0000-0000-00000000000d', 'dave');

select is(
  (select count(*)::integer from public.user_settings),
  4,
  'every new user gets a settings row'
);

-- Paella night in Russafa, Valencia, with two spots.
insert into public.events (id, organizer_id, title, starts_at, location, address, area_label, max_participants)
values (
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-00000000000a',
  'Paella night',
  now() + interval '1 day',
  'SRID=4326;POINT(-0.37631 39.46247)',
  'Carrer de Sueca 12, Valencia',
  'Russafa, Valencia',
  2
);

select is(
  (select count(*)::integer from public.event_aliases
   where event_id = '00000000-0000-0000-0000-0000000000e1' and is_organizer),
  1,
  'creating an event gives the organizer an alias marked as organizer'
);

-- ---------------------------------------------------------------- as Bob
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok(
  'select organizer_id from public.events',
  '42501', null,
  'the organizer of an event is not readable directly'
);
select throws_ok(
  'select address from public.events',
  '42501', null,
  'the exact address is not readable directly'
);
select throws_ok(
  'select * from public.event_aliases',
  '42501', null,
  'aliases are not readable at all'
);
select throws_ok(
  'select * from public.comments',
  '42501', null,
  'comments are only readable through event_comments()'
);
select throws_ok(
  $$update public.profiles set id_verified_at = now() where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null,
  'users cannot give themselves the verified badge'
);
select lives_ok(
  $$insert into public.events (title, starts_at, location, address, area_label)
    values ('Bob''s run', now() + interval '2 days', 'SRID=4326;POINT(-0.3500 39.4700)', 'Turia park', 'Turia, Valencia')$$,
  'a user can create an event and is set as its organizer'
);

select is(
  (select count(*)::integer from public.nearby_events(39.4699, -0.3763, 5)),
  1,
  'nearby finds the event within 5 km and hides the caller''s own events'
);
select is(
  (select count(*)::integer from public.nearby_events(39.70, -0.3763, 5)),
  0,
  'nearby leaves out events outside the radius'
);
select ok(
  (select distance_km * 2 = round(distance_km * 2) and approx_latitude = round(approx_latitude::numeric, 2)::double precision
   from public.nearby_events(39.4699, -0.3763, 5)),
  'nearby rounds the distance to 0.5 km and the point to about 1 km'
);

select is(
  (select address from public.get_event('00000000-0000-0000-0000-0000000000e1')),
  null,
  'the address stays hidden before saying yes'
);
select isnt(
  (select organizer_name from public.get_event('00000000-0000-0000-0000-0000000000e1')),
  'alice',
  'a non-friend sees the organizer''s alias, not their username'
);

select is(public.set_rsvp('00000000-0000-0000-0000-0000000000e1', 'yes'), 'yes'::public.rsvp_status, 'Bob gets a spot');
select is(
  (select address from public.get_event('00000000-0000-0000-0000-0000000000e1')),
  'Carrer de Sueca 12, Valencia',
  'the address is revealed after saying yes'
);
select throws_ok(
  $$select public.set_rsvp('00000000-0000-0000-0000-0000000000e1', 'waitlisted')$$,
  '22023', null,
  'nobody can put themselves on the waitlist directly'
);

select lives_ok(
  $$select public.post_comment('00000000-0000-0000-0000-0000000000e1', 'Do I need to bring anything?')$$,
  'Bob can comment'
);
select ok(
  (select is_mine and author_name <> 'bob' from public.event_comments('00000000-0000-0000-0000-0000000000e1')),
  'Bob sees his own comment under his alias'
);
select throws_ok(
  $$insert into public.event_updates (event_id, body) values ('00000000-0000-0000-0000-0000000000e1', 'Fake update')$$,
  '42501', null,
  'only the organizer can post updates'
);

-- ---------------------------------------------------------------- as Carol
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.set_rsvp('00000000-0000-0000-0000-0000000000e1', 'yes'), 'yes'::public.rsvp_status, 'Carol takes the last spot');
select isnt(
  (select author_name from public.event_comments('00000000-0000-0000-0000-0000000000e1')),
  'bob',
  'a non-friend sees Bob''s alias'
);

-- ---------------------------------------------------------------- as Dave
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.set_rsvp('00000000-0000-0000-0000-0000000000e1', 'yes'), 'waitlisted'::public.rsvp_status, 'Dave goes on the waitlist when the event is full');

-- ---------------------------------------------------------------- Bob drops out
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.set_rsvp('00000000-0000-0000-0000-0000000000e1', 'no'), 'no'::public.rsvp_status, 'Bob says no');
select is(
  (select count(*)::integer from public.nearby_events(39.4699, -0.3763, 5)),
  0,
  'events answered no drop out of nearby'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(
  (select status from public.rsvps where event_id = '00000000-0000-0000-0000-0000000000e1'),
  'yes'::public.rsvp_status,
  'Dave moves up from the waitlist when a spot frees up'
);
select is(
  (select count(*)::integer from public.rsvps),
  1,
  'users only see their own RSVPs'
);

-- ---------------------------------------------------------------- Bob and Carol become friends
reset role;
insert into public.friendships (requester_id, addressee_id, status)
values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 'accepted');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(
  (select author_name from public.event_comments('00000000-0000-0000-0000-0000000000e1')),
  'bob',
  'a friend sees Bob''s real username on his comment'
);
select is(
  (select friend_username from public.for_you_feed() where kind = 'friend_comment'),
  'bob',
  'Bob''s comment appears in his friend''s For you feed'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select isnt(
  (select author_name from public.event_comments('00000000-0000-0000-0000-0000000000e1')),
  'bob',
  'the organizer, not a friend of Bob, still sees his alias'
);
select lives_ok(
  $$insert into public.event_updates (event_id, body) values ('00000000-0000-0000-0000-0000000000e1', 'Bring a plate!')$$,
  'the organizer can post an update'
);
select lives_ok(
  $$select public.post_comment('00000000-0000-0000-0000-0000000000e1', 'Answer: just yourself')$$,
  'the organizer can comment'
);
select ok(
  (select author_is_organizer from public.event_comments('00000000-0000-0000-0000-0000000000e1') where body = 'Answer: just yourself'),
  'the organizer''s comment carries the organizer badge'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(
  (select body from public.for_you_feed() where kind = 'event_update'),
  'Bring a plate!',
  'organizer updates reach attendees in For you'
);

-- ---------------------------------------------------------------- Bob hides his activity, then they unfriend
reset role;
update public.user_settings set share_activity_with_friends = false where user_id = '00000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.for_you_feed() where kind = 'friend_comment'),
  0,
  'a friend who hides their activity does not appear in For you'
);

select lives_ok(
  $$delete from public.friendships where addressee_id = '00000000-0000-0000-0000-00000000000c'$$,
  'either side can end a friendship'
);
select isnt(
  (select author_name from public.event_comments('00000000-0000-0000-0000-0000000000e1') where not author_is_organizer),
  'bob',
  'after unfriending, Bob''s old comment goes back to his alias'
);

-- ---------------------------------------------------------------- blocking
reset role;
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.get_event('00000000-0000-0000-0000-0000000000e1')),
  0,
  'someone blocked by the organizer can no longer open the event'
);

-- ---------------------------------------------------------------- signed out
reset role;
set local role anon;
select throws_ok(
  $$select * from public.get_event('00000000-0000-0000-0000-0000000000e1')$$,
  '42501', null,
  'signed-out visitors cannot call the app functions'
);

select * from finish();
rollback;
