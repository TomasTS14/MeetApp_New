-- Phase 1: age confirmation at sign-up, and storage for event photos and avatars.

-- Spain's age of digital consent is 14. Onboarding asks people to confirm it, and a
-- profile cannot be created without that confirmation.
alter table public.profiles
  add column confirmed_minimum_age boolean not null default false;
alter table public.profiles
  add constraint profiles_minimum_age_confirmed check (confirmed_minimum_age);
grant insert (confirmed_minimum_age) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- Both buckets are public: files sit behind unguessable paths and only hold what the
-- app shows anyway. Uploads are checked against the folder: event photos go under
-- "<event id>/", avatars under "<user id>/".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-photos', 'event-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Returns the event id an event-photos object belongs to, or null for a malformed path.
create function private.event_id_from_path(p_name text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;
grant execute on function private.event_id_from_path(text) to authenticated;

create policy "organizers upload event photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-photos'
    and private.is_event_organizer(private.event_id_from_path(name), (select auth.uid()))
  );
create policy "organizers delete event photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-photos'
    and private.is_event_organizer(private.event_id_from_path(name), (select auth.uid()))
  );

create policy "users upload their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users replace their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete their own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Creating an event and getting its id back
-- ---------------------------------------------------------------------------
-- The app inserts an event and asks for its id in the same statement. The general read
-- policy looks the event up through can_see_event(), which cannot see a row inserted by
-- the same statement, so organizers also get a policy that checks the row directly.
create policy "organizers read their own events" on public.events
  for select to authenticated using (organizer_id = (select auth.uid()));
