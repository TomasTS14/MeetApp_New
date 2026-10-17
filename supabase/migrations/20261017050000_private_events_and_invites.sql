-- Step 1: private, invite-only events. The organizer invites friends from the event page,
-- or shares an invite link; only invited people (and people who already answered) can see
-- the event. Private events never appear in Nearby.

create table public.event_invites (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_invites_user_idx on public.event_invites (user_id);
alter table public.event_invites enable row level security;
-- Read and written only through the functions below.
revoke all on public.event_invites from anon, authenticated;

-- The secret in an event's invite link. Not selectable by clients; the organizer reads it
-- through event_invite_code().
alter table public.events
  add column invite_code text not null
    default replace(replace(replace(encode(extensions.gen_random_bytes(12), 'base64'), '+', '-'), '/', '_'), '=', '');

-- Invited people can now see private events too.
create or replace function private.can_see_event(p_event uuid, p_user uuid)
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
            or exists (select 1 from public.event_invites i where i.event_id = e.id and i.user_id = p_user)
          )
        )
      )
  );
$$;

create function public.event_invite_code(p_event uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select e.invite_code from public.events e where e.id = p_event and e.organizer_id = auth.uid();
$$;

-- The organizer invites friends. Anyone who is not a friend, or is blocked either way, is
-- skipped. Returns how many new invites were made.
create function public.invite_friends(p_event uuid, p_users uuid[])
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if not private.is_event_organizer(p_event, v_uid) then
    raise exception 'only the organizer can invite' using errcode = '42501';
  end if;

  insert into public.event_invites (event_id, user_id)
  select p_event, u
  from unnest(p_users) u
  where private.are_friends(v_uid, u) and not private.is_blocked_between(v_uid, u)
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Who the organizer invited, with their answer so far.
create function public.event_invitees(p_event uuid)
returns table (user_id uuid, username text, avatar_path text, rsvp public.rsvp_status)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.avatar_path, r.status
  from public.event_invites i
  join public.profiles p on p.id = i.user_id
  left join public.rsvps r on r.event_id = i.event_id and r.user_id = i.user_id
  where i.event_id = p_event and private.is_event_organizer(p_event, auth.uid())
  order by p.username;
$$;

create function public.uninvite(p_event uuid, p_user uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_event_organizer(p_event, auth.uid()) then
    raise exception 'only the organizer can uninvite' using errcode = '42501';
  end if;
  delete from public.event_invites where event_id = p_event and user_id = p_user;
end;
$$;

-- Opening an invite link adds the caller to the invited people. Returns false for a wrong
-- code, or when the organizer and the caller have blocked each other.
create function public.accept_invite(p_event uuid, p_code text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_organizer uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select e.organizer_id into v_organizer
  from public.events e
  where e.id = p_event and e.invite_code = p_code;
  if v_organizer is null or private.is_blocked_between(v_organizer, v_uid) then
    return false;
  end if;
  if v_organizer <> v_uid then
    insert into public.event_invites (event_id, user_id) values (p_event, v_uid) on conflict do nothing;
  end if;
  return true;
end;
$$;

-- Your events also lists private events you were invited to and have not answered.
create or replace function public.my_events(p_include_past boolean default false)
returns table (
  id uuid,
  title text,
  category public.event_category,
  starts_at timestamptz,
  ends_at timestamptz,
  area_label text,
  cancelled_at timestamptz,
  my_role text,
  cover_photo_path text
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  mine as (
    select e.id, 'organizer'::text as my_role
    from public.events e, me
    where e.organizer_id = me.uid
    union all
    select r.event_id, r.status::text
    from public.rsvps r, me
    where r.user_id = me.uid
      and r.status in ('yes', 'interested', 'waitlisted')
      and private.can_see_event(r.event_id, me.uid)
    union all
    select i.event_id, 'invited'
    from public.event_invites i, me
    where i.user_id = me.uid
      and not exists (select 1 from public.rsvps r where r.event_id = i.event_id and r.user_id = me.uid)
      and private.can_see_event(i.event_id, me.uid)
  )
  select
    e.id,
    e.title,
    e.category,
    e.starts_at,
    e.ends_at,
    e.area_label,
    e.cancelled_at,
    m.my_role,
    (select ph.storage_path from public.event_photos ph where ph.event_id = e.id order by ph.position limit 1)
  from mine m
  join public.events e on e.id = m.id
  where p_include_past or coalesce(e.ends_at, e.starts_at) >= now()
  order by e.starts_at;
$$;

revoke execute on function
  public.event_invite_code(uuid),
  public.invite_friends(uuid, uuid[]),
  public.event_invitees(uuid),
  public.uninvite(uuid, uuid),
  public.accept_invite(uuid, text)
from public, anon;
grant execute on function
  public.event_invite_code(uuid),
  public.invite_friends(uuid, uuid[]),
  public.event_invitees(uuid),
  public.uninvite(uuid, uuid),
  public.accept_invite(uuid, text)
to authenticated;
