-- Run with: supabase test db
-- Covers the minimum age confirmation and who may upload event photos and avatars.
begin;
select plan(7);

delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000000a', 'alice')$$,
  '23514', null,
  'a profile cannot be created without confirming the minimum age'
);
select lives_ok(
  $$insert into public.profiles (id, username, confirmed_minimum_age)
    values ('00000000-0000-0000-0000-00000000000a', 'alice', true)$$,
  'a profile is created once the minimum age is confirmed'
);
select lives_ok(
  $$insert into public.events (title, starts_at, location, address, area_label)
    values ('Tapas walk', now() + interval '2 days', 'SRID=4326;POINT(-0.3600 39.4800)', 'Plaça de Benimaclet 1', 'Benimaclet, Valencia')
    returning id$$,
  'creating an event returns its id to the organizer'
);
-- Alice's event, created directly so the test knows its id.
reset role;
insert into public.events (id, organizer_id, title, starts_at, location, address, area_label)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'Paella night',
        now() + interval '1 day', 'SRID=4326;POINT(-0.37631 39.46247)', 'Carrer de Sueca 12', 'Russafa, Valencia');
set local role authenticated;

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('event-photos', '00000000-0000-0000-0000-0000000000e1/cover.jpg')$$,
  'the organizer can upload photos into the event''s folder'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/me.jpg')$$,
  'users can upload their own avatar'
);

reset role;
insert into public.profiles (id, username, confirmed_minimum_age) values ('00000000-0000-0000-0000-00000000000b', 'bob', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('event-photos', '00000000-0000-0000-0000-0000000000e1/fake.jpg')$$,
  '42501', null,
  'someone else cannot upload photos to the event'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/fake.jpg')$$,
  '42501', null,
  'nobody can upload into another person''s avatar folder'
);

select * from finish();
rollback;
