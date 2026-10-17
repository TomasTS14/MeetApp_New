-- MeetApp core schema: profiles, friends, events, RSVPs, per-event aliases, comments,
-- organizer updates and reports.
--
-- Privacy model (see docs/privacy.md):
--   * Clients never learn who is behind an alias. event_aliases and comments have no
--     client grants at all; every read that shows an author goes through a security
--     definer function that resolves the name for the viewer (real name for friends,
--     alias for everyone else).
--   * events.organizer_id, the exact address and the exact location are not readable
--     directly. get_event() reveals the address and precise point only to the organizer
--     and to people who answered yes; everyone else gets the area label and a point
--     rounded to roughly 1 km.
--   * Helpers used by RLS policies live in the "private" schema, which the API does
--     not expose, so they cannot be called over REST.

create extension if not exists postgis with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated;

create type public.friendship_status as enum ('pending', 'accepted', 'declined');
create type public.rsvp_status as enum ('yes', 'interested', 'no', 'waitlisted');
create type public.event_visibility as enum ('public', 'private');
create type public.event_category as enum (
  'music', 'sport', 'food', 'nightlife', 'culture', 'outdoors', 'learning', 'social', 'other'
);
create type public.report_target as enum ('user', 'event', 'comment', 'event_update');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text,
  -- Set by the ID verification webhook (service role only), shown as the verified badge.
  id_verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,30}$')
);
create unique index profiles_username_key on public.profiles (username);

-- Favourite songs: Spotify links shown with Spotify's embedded player (no Spotify login).
create table public.profile_songs (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  spotify_url text not null check (spotify_url ~ '^https://open\.spotify\.com/'),
  title text,
  artist text,
  artwork_url text,
  primary key (profile_id, position)
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'es')),
  font_scale numeric(3, 2) not null default 1.00 check (font_scale between 0.80 and 1.60),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  default_radius_km integer not null default 10 check (default_radius_km between 1 and 200),
  -- Whether friends see my comments in their For you feed.
  share_activity_with_friends boolean not null default true,
  -- Whether friends see the events I said yes or interested to in their For you feed.
  share_attendance_with_friends boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.friendships (
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id)
);
-- One row per pair, whoever asked first.
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  category public.event_category not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz,
  max_participants integer check (max_participants > 0),
  location extensions.geography(point, 4326) not null,
  address text not null check (char_length(address) <= 300),
  -- Rough area shown to people who have not said yes, e.g. "Russafa, Valencia".
  area_label text not null check (char_length(area_label) <= 120),
  visibility public.event_visibility not null default 'public',
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at > starts_at)
);
create index events_location_idx on public.events using gist (location);
create index events_starts_at_idx on public.events (starts_at);
create index events_organizer_idx on public.events (organizer_id);

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0 check (position between 0 and 9),
  created_at timestamptz not null default now(),
  unique (event_id, position)
);

create table public.rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null,
  created_at timestamptz not null default now(),
  -- Changes only when the status changes, so it doubles as the waitlist position.
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index rsvps_user_idx on public.rsvps (user_id);
create index rsvps_waitlist_idx on public.rsvps (event_id, updated_at) where status = 'waitlisted';

-- One random alias per person per event. Never exposed together with user_id.
create table public.event_aliases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  alias text not null,
  is_organizer boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, user_id),
  unique (event_id, alias),
  unique (id, event_id)
);

-- Comments point at an alias, never at a user.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  alias_id uuid not null,
  reply_to uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (alias_id, event_id) references public.event_aliases (id, event_id) on delete cascade
);
create index comments_event_idx on public.comments (event_id, created_at);
create index comments_alias_idx on public.comments (alias_id);

-- Organizer posts, shown in their own thread on the event page, apart from comments.
create table public.event_updates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index event_updates_event_idx on public.event_updates (event_id, created_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Private helpers (used by policies and functions, not exposed over the API)
-- ---------------------------------------------------------------------------

create function private.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

create function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b) or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

create function private.is_event_organizer(p_event uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = p_event and e.organizer_id = p_user);
$$;

-- Public events are visible to everyone the organizer has not blocked (or been blocked by).
-- Private events are visible to the organizer and to people with an RSVP row (invites come later).
create function private.can_see_event(p_event uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and (
        e.organizer_id = p_user
        or (
          not private.is_blocked_between(e.organizer_id, p_user)
          and (
            e.visibility = 'public'
            or exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = p_user)
          )
        )
      )
  );
$$;

create function private.new_alias(p_event uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  adjectives constant text[] := array[
    'Quiet', 'Brave', 'Sunny', 'Curious', 'Gentle', 'Lucky', 'Swift', 'Clever', 'Calm', 'Bold',
    'Bright', 'Cosmic', 'Dreamy', 'Fuzzy', 'Golden', 'Happy', 'Jolly', 'Kind', 'Lively', 'Merry',
    'Mellow', 'Nimble', 'Proud', 'Rapid', 'Silver', 'Sleepy', 'Spicy', 'Steady', 'Wild', 'Witty'
  ];
  animals constant text[] := array[
    'Otter', 'Falcon', 'Panda', 'Fox', 'Heron', 'Lynx', 'Badger', 'Dolphin', 'Gecko', 'Koala',
    'Lemur', 'Moose', 'Owl', 'Puffin', 'Quokka', 'Raven', 'Seal', 'Tiger', 'Walrus', 'Yak',
    'Bison', 'Crane', 'Ferret', 'Hare', 'Ibis', 'Jaguar', 'Mantis', 'Newt', 'Orca', 'Squid'
  ];
  candidate text;
begin
  for attempt in 1..20 loop
    candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
      || ' ' || animals[1 + floor(random() * array_length(animals, 1))::int];
    if attempt > 10 then
      candidate := candidate || ' ' || (2 + floor(random() * 98))::int;
    end if;
    if not exists (select 1 from public.event_aliases a where a.event_id = p_event and a.alias = candidate) then
      return candidate;
    end if;
  end loop;
  return 'Guest ' || substr(md5(random()::text), 1, 6);
end;
$$;

-- Returns the caller's alias for an event, creating it on first use.
create function private.ensure_alias(p_event uuid, p_user uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select a.id into v_id from public.event_aliases a where a.event_id = p_event and a.user_id = p_user;
  if v_id is not null then
    return v_id;
  end if;

  for attempt in 1..5 loop
    begin
      insert into public.event_aliases (event_id, user_id, alias, is_organizer)
      values (p_event, p_user, private.new_alias(p_event), private.is_event_organizer(p_event, p_user))
      returning id into v_id;
      return v_id;
    exception when unique_violation then
      -- Either a concurrent call created this user's alias, or the alias text collided.
      select a.id into v_id from public.event_aliases a where a.event_id = p_event and a.user_id = p_user;
      if v_id is not null then
        return v_id;
      end if;
    end;
  end loop;
  raise exception 'could not create an alias for event %', p_event;
end;
$$;

grant execute on function
  private.are_friends(uuid, uuid),
  private.is_blocked_between(uuid, uuid),
  private.is_event_organizer(uuid, uuid),
  private.can_see_event(uuid, uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_new_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.ensure_alias(new.id, new.organizer_id);
  return new;
end;
$$;

create trigger on_event_created
  after insert on public.events
  for each row execute function private.handle_new_event();

create function private.handle_friendship_response()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

create trigger on_friendship_response
  before update on public.friendships
  for each row execute function private.handle_friendship_response();

-- Blocking someone ends any friendship or pending request between the two.
create function private.handle_block()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.friendships f
  where (f.requester_id = new.blocker_id and f.addressee_id = new.blocked_id)
     or (f.requester_id = new.blocked_id and f.addressee_id = new.blocker_id);
  return new;
end;
$$;

create trigger on_block_created
  after insert on public.blocks
  for each row execute function private.handle_block();

-- ---------------------------------------------------------------------------
-- Grants and row level security
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.profile_songs enable row level security;
alter table public.user_settings enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.events enable row level security;
alter table public.event_photos enable row level security;
alter table public.rsvps enable row level security;
alter table public.event_aliases enable row level security;
alter table public.comments enable row level security;
alter table public.event_updates enable row level security;
alter table public.reports enable row level security;

-- profiles: anyone signed in can look people up (needed for friend requests).
grant select (id, username, bio, avatar_path, id_verified_at, created_at) on public.profiles to authenticated;
grant insert (id, username, bio, avatar_path) on public.profiles to authenticated;
grant update (username, bio, avatar_path) on public.profiles to authenticated;
create policy "profiles are readable" on public.profiles
  for select to authenticated using (true);
create policy "users create their own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "users edit their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select, insert, update, delete on public.profile_songs to authenticated;
create policy "songs are readable" on public.profile_songs
  for select to authenticated using (true);
create policy "users manage their own songs" on public.profile_songs
  for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

grant select on public.user_settings to authenticated;
grant update (locale, font_scale, theme, default_radius_km, share_activity_with_friends,
              share_attendance_with_friends, updated_at)
  on public.user_settings to authenticated;
create policy "users read their own settings" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users edit their own settings" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, delete on public.friendships to authenticated;
grant insert (addressee_id) on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;
create policy "users see their own friendships" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "users send friend requests" on public.friendships
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and not private.is_blocked_between(requester_id, addressee_id)
  );
create policy "addressees answer friend requests" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status in ('accepted', 'declined'));
create policy "either side can end a friendship" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;
create policy "users manage their own blocks" on public.blocks
  for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- events: organizer, exact address and exact location are deliberately not selectable.
grant select (id, title, description, category, starts_at, ends_at, max_participants,
              area_label, visibility, cancelled_at, created_at)
  on public.events to authenticated;
grant insert (title, description, category, starts_at, ends_at, max_participants,
              location, address, area_label, visibility)
  on public.events to authenticated;
grant update (title, description, category, starts_at, ends_at, max_participants,
              location, address, area_label, visibility, cancelled_at)
  on public.events to authenticated;
grant delete on public.events to authenticated;
create policy "visible events are readable" on public.events
  for select to authenticated using (private.can_see_event(id, (select auth.uid())));
create policy "users create events they organize" on public.events
  for insert to authenticated
  with check (organizer_id = (select auth.uid()) and starts_at > now());
create policy "organizers edit their events" on public.events
  for update to authenticated
  using (organizer_id = (select auth.uid())) with check (organizer_id = (select auth.uid()));
create policy "organizers delete their events" on public.events
  for delete to authenticated using (organizer_id = (select auth.uid()));

grant select, insert, delete on public.event_photos to authenticated;
create policy "photos of visible events are readable" on public.event_photos
  for select to authenticated using (private.can_see_event(event_id, (select auth.uid())));
create policy "organizers manage photos" on public.event_photos
  for insert to authenticated with check (private.is_event_organizer(event_id, (select auth.uid())));
create policy "organizers delete photos" on public.event_photos
  for delete to authenticated using (private.is_event_organizer(event_id, (select auth.uid())));

-- rsvps: users read only their own answers; writes go through set_rsvp().
grant select on public.rsvps to authenticated;
create policy "users read their own rsvps" on public.rsvps
  for select to authenticated using (user_id = (select auth.uid()));

-- event_aliases and comments: no client access at all (RLS on, no grants, no policies).

grant select on public.event_updates to authenticated;
grant insert (event_id, body) on public.event_updates to authenticated;
grant update (body, edited_at) on public.event_updates to authenticated;
grant delete on public.event_updates to authenticated;
create policy "updates of visible events are readable" on public.event_updates
  for select to authenticated using (private.can_see_event(event_id, (select auth.uid())));
create policy "organizers post updates" on public.event_updates
  for insert to authenticated with check (private.is_event_organizer(event_id, (select auth.uid())));
create policy "organizers edit updates" on public.event_updates
  for update to authenticated
  using (private.is_event_organizer(event_id, (select auth.uid())))
  with check (private.is_event_organizer(event_id, (select auth.uid())));
create policy "organizers delete updates" on public.event_updates
  for delete to authenticated using (private.is_event_organizer(event_id, (select auth.uid())));

grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason) on public.reports to authenticated;
create policy "users file reports" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "users read their own reports" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));
