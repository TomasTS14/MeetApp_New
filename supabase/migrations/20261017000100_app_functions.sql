-- Functions the app calls over the API (supabase.rpc). They run as security definer so they
-- can read aliases and organizers, and they decide per viewer what to reveal.

-- ---------------------------------------------------------------------------
-- Waitlist
-- ---------------------------------------------------------------------------

-- Moves the oldest waitlisted people to "yes" while there are free spots.
create function private.promote_waitlist(p_event uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_max integer;
  v_going integer;
  v_promoted integer;
begin
  select e.max_participants into v_max from public.events e where e.id = p_event;
  select count(*) into v_going from public.rsvps r where r.event_id = p_event and r.status = 'yes';

  with next_in_line as (
    select w.user_id
    from public.rsvps w
    where w.event_id = p_event and w.status = 'waitlisted'
    order by w.updated_at, w.created_at
    limit case when v_max is null then null else greatest(v_max - v_going, 0) end
  )
  update public.rsvps r
  set status = 'yes', updated_at = now()
  from next_in_line n
  where r.event_id = p_event and r.user_id = n.user_id;

  get diagnostics v_promoted = row_count;
  return v_promoted;
end;
$$;

create function private.handle_capacity_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.promote_waitlist(new.id);
  return new;
end;
$$;

create trigger on_event_capacity_changed
  after update of max_participants on public.events
  for each row
  when (new.max_participants is distinct from old.max_participants)
  execute function private.handle_capacity_change();

-- ---------------------------------------------------------------------------
-- RSVPs
-- ---------------------------------------------------------------------------

-- Sets the caller's answer for an event. "yes" on a full event becomes "waitlisted";
-- leaving "yes" frees the spot for the next person on the waitlist. Returns the stored status.
create function public.set_rsvp(p_event uuid, p_status public.rsvp_status)
returns public.rsvp_status
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_previous public.rsvp_status;
  v_final public.rsvp_status := p_status;
  v_going integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_status = 'waitlisted' then
    raise exception 'waitlisted is set automatically' using errcode = '22023';
  end if;

  -- Lock the event so two people cannot take the last spot at once.
  select * into v_event from public.events e where e.id = p_event for update;
  if not found or not private.can_see_event(p_event, v_uid) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if v_event.organizer_id = v_uid then
    raise exception 'organizers do not answer their own events' using errcode = '22023';
  end if;
  if v_event.cancelled_at is not null or coalesce(v_event.ends_at, v_event.starts_at) < now() then
    raise exception 'this event is no longer open' using errcode = '22023';
  end if;

  select r.status into v_previous from public.rsvps r where r.event_id = p_event and r.user_id = v_uid;

  if p_status = 'yes' and v_previous is distinct from 'yes' and v_event.max_participants is not null then
    select count(*) into v_going from public.rsvps r where r.event_id = p_event and r.status = 'yes';
    if v_going >= v_event.max_participants then
      v_final := 'waitlisted';
    end if;
  end if;

  insert into public.rsvps as r (event_id, user_id, status)
  values (p_event, v_uid, v_final)
  on conflict (event_id, user_id) do update
    set status = excluded.status,
        updated_at = case when r.status is distinct from excluded.status then now() else r.updated_at end;

  if v_previous = 'yes' and v_final <> 'yes' then
    perform private.promote_waitlist(p_event);
  end if;

  return v_final;
end;
$$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

-- Nearby tab: public, upcoming events within the radius, excluding ones the caller said no to.
-- Distance is rounded to 0.5 km and the point to about 1 km, so the exact spot cannot be
-- worked out from repeated queries.
create function public.nearby_events(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision,
  p_starts_after timestamptz default now(),
  p_starts_before timestamptz default null,
  p_categories public.event_category[] default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  category public.event_category,
  starts_at timestamptz,
  ends_at timestamptz,
  area_label text,
  distance_km numeric,
  approx_latitude double precision,
  approx_longitude double precision,
  max_participants integer,
  going_count integer,
  organizer_is_verified boolean,
  cover_photo_path text,
  my_rsvp public.rsvp_status
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography as point
  )
  select
    e.id,
    e.title,
    e.category,
    e.starts_at,
    e.ends_at,
    e.area_label,
    greatest(0.5, round((extensions.st_distance(e.location, origin.point) / 500)::numeric) * 0.5),
    round(extensions.st_y(e.location::extensions.geometry)::numeric, 2)::double precision,
    round(extensions.st_x(e.location::extensions.geometry)::numeric, 2)::double precision,
    e.max_participants,
    (select count(*)::integer from public.rsvps g where g.event_id = e.id and g.status = 'yes'),
    o.id_verified_at is not null,
    (select ph.storage_path from public.event_photos ph where ph.event_id = e.id order by ph.position limit 1),
    r.status
  from public.events e
  cross join me
  cross join origin
  join public.profiles o on o.id = e.organizer_id
  left join public.rsvps r on r.event_id = e.id and r.user_id = me.uid
  where me.uid is not null
    and extensions.st_dwithin(e.location, origin.point, least(greatest(p_radius_km, 1), 200) * 1000)
    and e.visibility = 'public'
    and e.cancelled_at is null
    and coalesce(e.ends_at, e.starts_at) >= coalesce(p_starts_after, now())
    and (p_starts_before is null or e.starts_at < p_starts_before)
    and (p_categories is null or e.category = any (p_categories))
    and e.organizer_id <> me.uid
    and not private.is_blocked_between(e.organizer_id, me.uid)
    and r.status is distinct from 'no'
  order by e.starts_at, extensions.st_distance(e.location, origin.point)
  limit least(greatest(p_limit, 1), 100);
$$;

-- Event page. The exact address and point are returned only to the organizer and to people
-- who said yes. The organizer appears under their alias unless the caller is their friend.
create function public.get_event(p_event uuid)
returns table (
  id uuid,
  title text,
  description text,
  category public.event_category,
  starts_at timestamptz,
  ends_at timestamptz,
  max_participants integer,
  going_count integer,
  interested_count integer,
  waitlist_count integer,
  area_label text,
  address text,
  latitude double precision,
  longitude double precision,
  location_is_exact boolean,
  visibility public.event_visibility,
  cancelled_at timestamptz,
  organizer_name text,
  organizer_is_friend boolean,
  organizer_is_verified boolean,
  is_organizer boolean,
  my_rsvp public.rsvp_status,
  photo_paths text[]
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  ev as (
    select
      e.*,
      e.organizer_id = me.uid as mine,
      r.status as my_status,
      (e.organizer_id = me.uid or r.status = 'yes') as exact,
      private.are_friends(e.organizer_id, me.uid) as friend
    from public.events e
    cross join me
    left join public.rsvps r on r.event_id = e.id and r.user_id = me.uid
    where e.id = p_event and private.can_see_event(e.id, me.uid)
  )
  select
    ev.id,
    ev.title,
    ev.description,
    ev.category,
    ev.starts_at,
    ev.ends_at,
    ev.max_participants,
    (select count(*)::integer from public.rsvps g where g.event_id = ev.id and g.status = 'yes'),
    (select count(*)::integer from public.rsvps g where g.event_id = ev.id and g.status = 'interested'),
    (select count(*)::integer from public.rsvps g where g.event_id = ev.id and g.status = 'waitlisted'),
    ev.area_label,
    case when ev.exact then ev.address end,
    case when ev.exact then extensions.st_y(ev.location::extensions.geometry)
         else round(extensions.st_y(ev.location::extensions.geometry)::numeric, 2)::double precision end,
    case when ev.exact then extensions.st_x(ev.location::extensions.geometry)
         else round(extensions.st_x(ev.location::extensions.geometry)::numeric, 2)::double precision end,
    ev.exact,
    ev.visibility,
    ev.cancelled_at,
    case when ev.friend then o.username else oa.alias end,
    ev.friend,
    o.id_verified_at is not null,
    ev.mine,
    ev.my_status,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position) from public.event_photos ph where ph.event_id = ev.id),
      '{}'
    )
  from ev
  join public.profiles o on o.id = ev.organizer_id
  left join public.event_aliases oa on oa.event_id = ev.id and oa.user_id = ev.organizer_id;
$$;

-- Your events tab: events the caller organizes or answered yes, interested or waitlisted.
create function public.my_events(p_include_past boolean default false)
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

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create function public.post_comment(p_event uuid, p_body text, p_reply_to uuid default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_alias uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.can_see_event(p_event, v_uid) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if p_reply_to is not null
     and not exists (select 1 from public.comments c where c.id = p_reply_to and c.event_id = p_event) then
    raise exception 'comment to reply to not found' using errcode = 'P0002';
  end if;

  v_alias := private.ensure_alias(p_event, v_uid);
  insert into public.comments (event_id, alias_id, reply_to, body)
  values (p_event, v_alias, p_reply_to, btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

-- Authors can delete their own comments; organizers can delete any comment on their event.
create function public.delete_comment(p_comment uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.comments c
  set deleted_at = now()
  from public.event_aliases a
  where c.id = p_comment
    and a.id = c.alias_id
    and c.deleted_at is null
    and (a.user_id = v_uid or private.is_event_organizer(c.event_id, v_uid));
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Comments on an event as the caller may see them: friends under their real username,
-- everyone else (and the caller's own comments) under the per-event alias.
create function public.event_comments(p_event uuid)
returns table (
  id uuid,
  reply_to uuid,
  body text,
  created_at timestamptz,
  is_deleted boolean,
  author_name text,
  author_avatar_path text,
  author_is_organizer boolean,
  author_is_verified boolean,
  author_is_friend boolean,
  is_mine boolean
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  rows as (
    select
      c.*,
      a.alias,
      a.is_organizer,
      a.user_id = me.uid as mine,
      private.are_friends(a.user_id, me.uid) as friend,
      p.username,
      p.avatar_path,
      p.id_verified_at
    from public.comments c
    cross join me
    join public.event_aliases a on a.id = c.alias_id
    join public.profiles p on p.id = a.user_id
    where c.event_id = p_event
      and private.can_see_event(p_event, me.uid)
      and not private.is_blocked_between(a.user_id, me.uid)
  )
  select
    rows.id,
    rows.reply_to,
    case when rows.deleted_at is null then rows.body end,
    rows.created_at,
    rows.deleted_at is not null,
    case when rows.friend and not rows.mine then rows.username else rows.alias end,
    case when rows.friend or rows.mine then rows.avatar_path end,
    rows.is_organizer,
    rows.id_verified_at is not null,
    rows.friend,
    rows.mine
  from rows
  order by rows.created_at;
$$;

-- ---------------------------------------------------------------------------
-- For you feed
-- ---------------------------------------------------------------------------

-- Friends' comments and RSVPs (each friend's privacy settings permitting) and organizer
-- updates on events the caller said yes or interested to. Newest first; pass the oldest
-- occurred_at you have as p_before to load the next page.
create function public.for_you_feed(p_before timestamptz default null, p_limit integer default 30)
returns table (
  kind text,
  occurred_at timestamptz,
  event_id uuid,
  event_title text,
  friend_id uuid,
  friend_username text,
  friend_avatar_path text,
  body text,
  rsvp_status public.rsvp_status
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  friends as (
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f, me
    where f.status = 'accepted' and me.uid in (f.requester_id, f.addressee_id)
  ),
  items as (
    select 'friend_comment'::text as kind, c.created_at as occurred_at, c.event_id,
           a.user_id as friend_id, c.body, null::public.rsvp_status as rsvp_status
    from public.comments c
    join public.event_aliases a on a.id = c.alias_id
    join friends fr on fr.friend_id = a.user_id
    join public.user_settings s on s.user_id = a.user_id and s.share_activity_with_friends
    where c.deleted_at is null and (c.created_at < p_before or p_before is null)
    union all
    select 'friend_rsvp', r.updated_at, r.event_id, r.user_id, null, r.status
    from public.rsvps r
    join friends fr on fr.friend_id = r.user_id
    join public.user_settings s on s.user_id = r.user_id and s.share_attendance_with_friends
    where r.status in ('yes', 'interested') and (r.updated_at < p_before or p_before is null)
    union all
    select 'event_update', u.created_at, u.event_id, null, u.body, null
    from public.event_updates u
    join public.rsvps r on r.event_id = u.event_id
    join me on r.user_id = me.uid
    where r.status in ('yes', 'interested', 'waitlisted') and (u.created_at < p_before or p_before is null)
  )
  select i.kind, i.occurred_at, i.event_id, e.title, i.friend_id, p.username, p.avatar_path, i.body, i.rsvp_status
  from items i
  cross join me
  join public.events e on e.id = i.event_id
  left join public.profiles p on p.id = i.friend_id
  where private.can_see_event(i.event_id, me.uid)
  order by i.occurred_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.set_rsvp(uuid, public.rsvp_status),
  public.nearby_events(double precision, double precision, double precision, timestamptz, timestamptz, public.event_category[], integer),
  public.get_event(uuid),
  public.my_events(boolean),
  public.post_comment(uuid, text, uuid),
  public.delete_comment(uuid),
  public.event_comments(uuid),
  public.for_you_feed(timestamptz, integer)
from public, anon;

grant execute on function
  public.set_rsvp(uuid, public.rsvp_status),
  public.nearby_events(double precision, double precision, double precision, timestamptz, timestamptz, public.event_category[], integer),
  public.get_event(uuid),
  public.my_events(boolean),
  public.post_comment(uuid, text, uuid),
  public.delete_comment(uuid),
  public.event_comments(uuid),
  public.for_you_feed(timestamptz, integer)
to authenticated;

-- Private helpers are reachable only from SQL, but lock them down anyway: only the
-- four used inside row level security policies stay executable by signed-in users.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.are_friends(uuid, uuid),
  private.is_blocked_between(uuid, uuid),
  private.is_event_organizer(uuid, uuid),
  private.can_see_event(uuid, uuid)
to authenticated;
