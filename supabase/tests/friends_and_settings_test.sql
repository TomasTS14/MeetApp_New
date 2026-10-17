-- Run with: supabase test db
-- Covers friend requests, blocking and personal settings as the app uses them.
begin;
select plan(9);

delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com');
insert into public.profiles (id, username, confirmed_minimum_age) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', true),
  ('00000000-0000-0000-0000-00000000000b', 'bob', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.friendships (addressee_id) values ('00000000-0000-0000-0000-00000000000b')$$,
  'Alice sends Bob a friend request'
);
select is(
  (select count(*)::integer from public.friendships
   where requester_id = '00000000-0000-0000-0000-00000000000a' and status = 'pending'),
  1,
  'the request starts as pending, sent by Alice'
);
update public.friendships set status = 'accepted' where addressee_id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select status::text from public.friendships),
  'pending',
  'Alice cannot accept her own request'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
update public.friendships set status = 'accepted' where requester_id = '00000000-0000-0000-0000-00000000000a';
select is((select status::text from public.friendships), 'accepted', 'Bob accepts');

select lives_ok(
  $$insert into public.blocks (blocked_id) values ('00000000-0000-0000-0000-00000000000a')$$,
  'Bob blocks Alice'
);
select is((select count(*)::integer from public.friendships), 0, 'blocking ends the friendship');

-- Settings
update public.user_settings set locale = 'es', font_scale = 1.40, theme = 'dark';
select is(
  (select locale || ' ' || font_scale || ' ' || theme from public.user_settings),
  'es 1.40 dark',
  'Bob changes his own settings'
);
select throws_ok(
  $$update public.user_settings set font_scale = 3$$,
  '23514', null,
  'text size stays within the allowed range'
);

reset role;
select is(
  (select locale from public.user_settings where user_id = '00000000-0000-0000-0000-00000000000a'),
  'en',
  'Alice''s settings were not touched'
);

select * from finish();
rollback;
