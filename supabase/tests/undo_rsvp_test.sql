-- Run with: supabase test db
-- Covers undoing an answer from the Nearby deck.
begin;
select plan(4);

delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com');
insert into public.profiles (id, username, confirmed_minimum_age) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', true),
  ('00000000-0000-0000-0000-00000000000b', 'bob', true),
  ('00000000-0000-0000-0000-00000000000c', 'carol', true);
insert into public.events (id, organizer_id, title, starts_at, location, address, area_label, max_participants)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'Paella night',
        now() + interval '1 day', 'SRID=4326;POINT(-0.37631 39.46247)', 'Carrer de Sueca 12', 'Russafa, Valencia', 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select public.set_rsvp('00000000-0000-0000-0000-0000000000e1', 'yes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.set_rsvp('00000000-0000-0000-0000-0000000000e1', 'yes'), 'waitlisted'::public.rsvp_status, 'Carol is waitlisted');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$select public.clear_rsvp('00000000-0000-0000-0000-0000000000e1')$$, 'Bob undoes his yes');
select is(
  (select my_rsvp from public.get_event('00000000-0000-0000-0000-0000000000e1')),
  null,
  'Bob has no answer any more, so the event is back in his deck'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(
  (select my_rsvp from public.get_event('00000000-0000-0000-0000-0000000000e1')),
  'yes'::public.rsvp_status,
  'the freed spot goes to Carol from the waitlist'
);

select * from finish();
rollback;
