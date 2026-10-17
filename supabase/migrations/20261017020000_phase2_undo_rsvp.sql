-- Phase 2: undoing a swipe in Nearby removes the answer completely, so the event goes back
-- into the deck. Leaving "yes" frees the spot for the next person on the waitlist.
create function public.clear_rsvp(p_event uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_previous public.rsvp_status;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- Same lock as set_rsvp, so a freed spot and a new "yes" cannot race.
  perform 1 from public.events e where e.id = p_event for update;

  delete from public.rsvps r
  where r.event_id = p_event and r.user_id = v_uid
  returning r.status into v_previous;

  if v_previous = 'yes' then
    perform private.promote_waitlist(p_event);
  end if;
end;
$$;

revoke execute on function public.clear_rsvp(uuid) from public, anon;
grant execute on function public.clear_rsvp(uuid) to authenticated;
