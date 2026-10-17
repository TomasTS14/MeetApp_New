-- Run with: supabase test db
-- Covers reporting, the admin queue and the limits against spam.
begin;
select plan(13);

delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com');
insert into public.profiles (id, username, confirmed_minimum_age) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', true),
  ('00000000-0000-0000-0000-00000000000b', 'bob', true),
  ('00000000-0000-0000-0000-00000000000c', 'carol', true);
insert into private.admins (user_id) values ('00000000-0000-0000-0000-00000000000c');
insert into public.events (id, organizer_id, title, starts_at, location, address, area_label) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'Alice''s paella',
   now() + interval '2 days', 'SRID=4326;POINT(-0.3763 39.4699)', 'Calle Mayor 1', 'Russafa, Valencia');

set local role authenticated;

-- Bob comments under his alias, then Alice reports the comment.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select set_config('test.comment', public.post_comment('00000000-0000-0000-0000-0000000000e1', 'Buy cheap watches at spam.example')::text, true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.reports (target_type, target_id, reason)
    values ('comment', current_setting('test.comment')::uuid, 'Spam')$$,
  'Alice reports the comment'
);
select throws_ok(
  $$insert into public.reports (target_type, target_id, reason)
    values ('comment', current_setting('test.comment')::uuid, 'Spam again')$$,
  '23505', null,
  'the same person cannot report the same thing twice while it is open'
);
select is(public.is_admin(), false, 'Alice is not an admin');
select throws_ok($$select * from public.admin_reports()$$, '42501', null, 'non-admins cannot read the queue');
select throws_ok(
  $$select public.admin_resolve_reports('comment', current_setting('test.comment')::uuid, 'removed')$$,
  '42501', null,
  'non-admins cannot act on reports'
);

-- Carol is an admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.is_admin(), true, 'Carol is an admin');
select is(
  (select author_username from public.admin_reports()),
  'bob',
  'the queue shows who wrote the reported comment'
);
select is(
  (select report_count from public.admin_reports()),
  1,
  'the queue counts reports per comment'
);
select lives_ok(
  $$select public.admin_resolve_reports('comment', (select target_id from public.admin_reports()), 'removed')$$,
  'Carol removes the comment'
);
select is(
  (select count(*)::integer from public.admin_reports()),
  0,
  'the queue is empty once the report is handled'
);

reset role;
select isnt((select deleted_at from public.comments), null, 'the comment is deleted');
select is((select resolution from public.reports), 'removed', 'the report records what was done');
set local role authenticated;

-- Bob tries to flood the comments.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.post_comment('00000000-0000-0000-0000-0000000000e1', 'spam ' || n) from generate_series(1, 10) n$$,
  'MA429', null,
  'a tenth comment within a minute is refused'
);

select * from finish();
rollback;
