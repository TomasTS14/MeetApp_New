-- Run with: supabase test db
-- Covers private events: who can see them, invites from the organizer and invite links.
begin;
select plan(11);

delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@example.com');
insert into public.profiles (id, username, confirmed_minimum_age) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', true),
  ('00000000-0000-0000-0000-00000000000b', 'bob', true),
  ('00000000-0000-0000-0000-00000000000c', 'carol', true),
  ('00000000-0000-0000-0000-00000000000d', 'dan', true);
-- Alice and Bob are friends; Carol is a stranger to Alice.
insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');
insert into public.events (id, organizer_id, title, starts_at, location, address, area_label, visibility) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'Alice''s birthday',
   now() + interval '2 days', 'SRID=4326;POINT(-0.3763 39.4699)', 'Calle Mayor 1', 'Russafa, Valencia', 'private');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::integer from public.events), 0, 'Bob cannot see the private event before he is invited');
select is(
  (select count(*)::integer from public.nearby_events(39.4699, -0.3763, 10)),
  0,
  'private events never appear in Nearby'
);
select is(public.event_invite_code('00000000-0000-0000-0000-0000000000e1'), null, 'only the organizer gets the invite code');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(
  public.invite_friends('00000000-0000-0000-0000-0000000000e1',
    array['00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c']::uuid[]),
  1,
  'Alice can invite her friend Bob but not the stranger Carol'
);
select set_config('test.code', public.event_invite_code('00000000-0000-0000-0000-0000000000e1'), true);
select is(
  (select array_agg(username) from public.event_invitees('00000000-0000-0000-0000-0000000000e1')),
  array['bob'],
  'Alice sees who she invited'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select title from public.events), 'Alice''s birthday', 'Bob sees the event once invited');
select is(
  (select my_role from public.my_events()),
  'invited',
  'the invitation shows in Bob''s events'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.accept_invite('00000000-0000-0000-0000-0000000000e1', 'wrong-code'), false, 'a wrong invite code does nothing');
select is(
  public.accept_invite('00000000-0000-0000-0000-0000000000e1', current_setting('test.code')),
  true,
  'Carol joins through the invite link'
);
select is((select count(*)::integer from public.events), 1, 'Carol can see the event now');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.invite_friends('00000000-0000-0000-0000-0000000000e1', array['00000000-0000-0000-0000-00000000000d']::uuid[])$$,
  '42501', null,
  'only the organizer can invite'
);

select * from finish();
rollback;
