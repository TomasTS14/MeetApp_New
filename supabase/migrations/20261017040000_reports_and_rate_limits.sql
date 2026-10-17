-- Step 1: reporting, an admin queue to act on reports, and limits against spam.

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

-- One open report per person per target; reporting again is a no-op in the app.
create unique index reports_one_open_per_reporter
  on public.reports (reporter_id, target_type, target_id)
  where resolved_at is null;
create index reports_open_idx on public.reports (target_type, target_id) where resolved_at is null;

-- What an admin did with a target's reports.
alter table public.reports
  add column resolution text check (resolution in ('dismissed', 'removed', 'banned'));

-- Admins see the report queue and act on it. Added by hand (SQL editor), never by the app.
create table private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Who wrote a reported thing. Admins need it to ban; it never leaves admin functions.
create function private.report_target_author(p_type public.report_target, p_target uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case p_type
    when 'user' then (select p.id from public.profiles p where p.id = p_target)
    when 'event' then (select e.organizer_id from public.events e where e.id = p_target)
    when 'event_update' then (select e.organizer_id from public.event_updates u
                              join public.events e on e.id = u.event_id where u.id = p_target)
    when 'comment' then (select a.user_id from public.comments c
                         join public.event_aliases a on a.id = c.alias_id where c.id = p_target)
  end;
$$;

-- The open queue: one row per reported thing, most reported first. Admins see who wrote
-- a reported comment, because acting on abuse behind an alias needs it.
create function public.admin_reports()
returns table (
  target_type public.report_target,
  target_id uuid,
  report_count integer,
  reasons text[],
  first_reported_at timestamptz,
  event_id uuid,
  event_title text,
  preview text,
  author_id uuid,
  author_username text,
  author_is_banned boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  return query
  with open as (
    select r.target_type, r.target_id, count(*)::integer as report_count,
           array_agg(r.reason order by r.created_at) as reasons, min(r.created_at) as first_reported_at
    from public.reports r
    where r.resolved_at is null
    group by r.target_type, r.target_id
  ),
  described as (
    select o.*,
      case o.target_type
        when 'event' then o.target_id
        when 'event_update' then (select u.event_id from public.event_updates u where u.id = o.target_id)
        when 'comment' then (select c.event_id from public.comments c where c.id = o.target_id)
      end as event_id,
      case o.target_type
        when 'user' then (select p.bio from public.profiles p where p.id = o.target_id)
        when 'event' then (select e.description from public.events e where e.id = o.target_id)
        when 'event_update' then (select u.body from public.event_updates u where u.id = o.target_id)
        when 'comment' then (select case when c.deleted_at is null then c.body end
                             from public.comments c where c.id = o.target_id)
      end as preview,
      private.report_target_author(o.target_type, o.target_id) as author_id
    from open o
  )
  select d.target_type, d.target_id, d.report_count, d.reasons, d.first_reported_at,
         d.event_id, e.title, d.preview, d.author_id, p.username,
         coalesce(u.banned_until > now(), false)
  from described d
  left join public.events e on e.id = d.event_id
  left join public.profiles p on p.id = d.author_id
  left join auth.users u on u.id = d.author_id
  order by d.report_count desc, d.first_reported_at;
end;
$$;

-- Closes every open report on a target. With p_remove, the reported comment or update is
-- deleted, or the reported event is cancelled. Banning a person goes through the
-- ban-user edge function, which then calls this with 'banned'.
create function public.admin_resolve_reports(
  p_target_type public.report_target,
  p_target uuid,
  p_resolution text
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_resolution not in ('dismissed', 'removed', 'banned') then
    raise exception 'unknown resolution' using errcode = '22023';
  end if;

  if p_resolution = 'removed' then
    case p_target_type
      when 'comment' then
        update public.comments set deleted_at = now() where id = p_target and deleted_at is null;
      when 'event_update' then
        delete from public.event_updates where id = p_target;
      when 'event' then
        update public.events set cancelled_at = now() where id = p_target and cancelled_at is null;
      when 'user' then
        raise exception 'people are banned, not removed' using errcode = '22023';
    end case;
  end if;

  update public.reports
  set resolved_at = now(), resolution = p_resolution
  where target_type = p_target_type and target_id = p_target and resolved_at is null;
end;
$$;

revoke execute on function public.admin_reports() from public, anon;
revoke execute on function public.admin_resolve_reports(public.report_target, uuid, text) from public, anon;
grant execute on function public.admin_reports() to authenticated;
grant execute on function public.admin_resolve_reports(public.report_target, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rate limits
-- ---------------------------------------------------------------------------

-- Raised when someone does something too often. The app shows its own message for it.
create function private.rate_limited()
returns void
language plpgsql
as $$
begin
  raise exception 'rate_limited' using errcode = 'MA429',
    hint = 'Too many in a short time. Try again later.';
end;
$$;

-- Counts the caller's recent rows per table. Inserts without a signed-in caller (seed
-- data, admin tools) are never limited.
create function private.enforce_rate_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;
  end if;

  case tg_table_name
    when 'comments' then
      if (select count(*) from public.comments c join public.event_aliases a on a.id = c.alias_id
          where a.user_id = v_uid and c.created_at > now() - interval '1 minute') >= 10
         or (select count(*) from public.comments c join public.event_aliases a on a.id = c.alias_id
             where a.user_id = v_uid and c.created_at > now() - interval '1 day') >= 200 then
        perform private.rate_limited();
      end if;
    when 'friendships' then
      if (select count(*) from public.friendships f
          where f.requester_id = v_uid and f.created_at > now() - interval '1 day') >= 30 then
        perform private.rate_limited();
      end if;
    when 'reports' then
      if (select count(*) from public.reports r
          where r.reporter_id = v_uid and r.created_at > now() - interval '1 day') >= 20 then
        perform private.rate_limited();
      end if;
    when 'events' then
      if (select count(*) from public.events e
          where e.organizer_id = v_uid and e.created_at > now() - interval '1 day') >= 10 then
        perform private.rate_limited();
      end if;
    when 'event_updates' then
      if (select count(*) from public.event_updates u join public.events e on e.id = u.event_id
          where e.organizer_id = v_uid and u.created_at > now() - interval '1 hour') >= 10 then
        perform private.rate_limited();
      end if;
  end case;
  return new;
end;
$$;

create trigger comments_rate_limit before insert on public.comments
  for each row execute function private.enforce_rate_limits();
create trigger friendships_rate_limit before insert on public.friendships
  for each row execute function private.enforce_rate_limits();
create trigger reports_rate_limit before insert on public.reports
  for each row execute function private.enforce_rate_limits();
create trigger events_rate_limit before insert on public.events
  for each row execute function private.enforce_rate_limits();
create trigger event_updates_rate_limit before insert on public.event_updates
  for each row execute function private.enforce_rate_limits();

-- As in app_functions: private helpers are reachable only from SQL.
revoke all on private.admins from public, anon, authenticated;
revoke execute on function
  private.report_target_author(public.report_target, uuid),
  private.rate_limited(),
  private.enforce_rate_limits()
from public, anon, authenticated;
