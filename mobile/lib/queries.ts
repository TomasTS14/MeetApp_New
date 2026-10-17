import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EVENT_PHOTO_MAX_SIDE, shrinkPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { EventCategory, EventComment, EventDetails, MyEvent, NearbyEvent, RsvpStatus } from '@/lib/types';

export type NearbyFilters = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  startsAfter: Date | null;
  startsBefore: Date | null;
  categories: EventCategory[];
};

export function useNearbyEvents(filters: NearbyFilters | null) {
  return useQuery({
    queryKey: ['nearby', filters],
    enabled: !!filters,
    queryFn: async () => {
      const f = filters!;
      const { data, error } = await supabase.rpc('nearby_events', {
        p_latitude: f.latitude,
        p_longitude: f.longitude,
        p_radius_km: f.radiusKm,
        p_starts_after: (f.startsAfter ?? new Date()).toISOString(),
        p_starts_before: f.startsBefore?.toISOString(),
        p_categories: f.categories.length > 0 ? f.categories : undefined,
      });
      if (error) throw error;
      return data as NearbyEvent[];
    },
  });
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_event', { p_event: eventId });
      if (error) throw error;
      return ((data as EventDetails[])[0] ?? null) as EventDetails | null;
    },
  });
}

export function useMyEvents() {
  return useQuery({
    queryKey: ['my-events'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_events', {});
      if (error) throw error;
      return data as MyEvent[];
    },
  });
}

export function useSetRsvp(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: Exclude<RsvpStatus, 'waitlisted'>) => {
      const { data, error } = await supabase.rpc('set_rsvp', { p_event: eventId, p_status: status });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['nearby'] });
    },
  });
}

// Answering from the Nearby deck, where each swipe is about a different event.
export function useAnswerEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: Exclude<RsvpStatus, 'waitlisted'> }) => {
      const { data, error } = await supabase.rpc('set_rsvp', { p_event: eventId, p_status: status });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
    },
  });
}

// Undo for the last swipe: removes the answer so the event goes back into the deck.
export function useClearRsvp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('clear_rsvp', { p_event: eventId });
      if (error) throw error;
    },
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['nearby'] });
    },
  });
}

export function useCancelEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('events')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
    },
  });
}

export type NewPhoto = { uri: string; mimeType: string };

// Photos go under the event's folder at the given positions (0 to 9, unique per event);
// the lowest position is the cover.
async function uploadPhotos(eventId: string, photos: NewPhoto[], positions: number[]) {
  for (const [index, photo] of photos.entries()) {
    const position = positions[index];
    const small = await shrinkPhoto(photo.uri, EVENT_PHOTO_MAX_SIDE);
    const body = await (await fetch(small.uri)).arrayBuffer();
    const path = `${eventId}/${position}-${Date.now()}.jpg`;
    const upload = await supabase.storage.from('event-photos').upload(path, body, { contentType: small.mimeType });
    if (upload.error) throw upload.error;
    const row = await supabase.from('event_photos').insert({ event_id: eventId, storage_path: path, position });
    if (row.error) throw row.error;
  }
}

export type NewEvent = {
  title: string;
  description: string;
  category: EventCategory;
  startsAt: Date;
  endsAt: Date | null;
  maxParticipants: number | null;
  latitude: number;
  longitude: number;
  address: string;
  areaLabel: string;
  isPrivate: boolean;
  photos: NewPhoto[];
};

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: NewEvent) => {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: event.title.trim(),
          description: event.description.trim(),
          category: event.category,
          starts_at: event.startsAt.toISOString(),
          ends_at: event.endsAt?.toISOString() ?? null,
          max_participants: event.maxParticipants,
          location: `SRID=4326;POINT(${event.longitude} ${event.latitude})`,
          address: event.address.trim(),
          area_label: event.areaLabel.trim(),
          visibility: event.isPrivate ? 'private' : 'public',
        })
        .select('id')
        .single();
      if (error) throw error;

      await uploadPhotos(data.id, event.photos, event.photos.map((_, i) => i));
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
    },
  });
}

export type EventChanges = Omit<NewEvent, 'photos'> & {
  // Photos already on the event to delete, and new ones to add after the rest.
  removedPhotoPaths: string[];
  newPhotos: NewPhoto[];
};

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: EventChanges) => {
      const { error } = await supabase
        .from('events')
        .update({
          title: event.title.trim(),
          description: event.description.trim(),
          category: event.category,
          starts_at: event.startsAt.toISOString(),
          ends_at: event.endsAt?.toISOString() ?? null,
          max_participants: event.maxParticipants,
          location: `SRID=4326;POINT(${event.longitude} ${event.latitude})`,
          address: event.address.trim(),
          area_label: event.areaLabel.trim(),
          visibility: event.isPrivate ? 'private' : 'public',
        })
        .eq('id', eventId);
      if (error) throw error;

      if (event.removedPhotoPaths.length > 0) {
        const rows = await supabase
          .from('event_photos')
          .delete()
          .eq('event_id', eventId)
          .in('storage_path', event.removedPhotoPaths);
        if (rows.error) throw rows.error;
        await supabase.storage.from('event-photos').remove(event.removedPhotoPaths);
      }
      if (event.newPhotos.length > 0) {
        const existing = await supabase.from('event_photos').select('position').eq('event_id', eventId);
        if (existing.error) throw existing.error;
        const taken = new Set(existing.data.map((row) => row.position));
        const highest = Math.max(-1, ...taken);
        // New photos go after the existing ones; if that runs past 9, into any gap.
        const free = [...Array(10).keys()].filter((p) => !taken.has(p));
        const positions = [...free.filter((p) => p > highest), ...free.filter((p) => p < highest)];
        await uploadPhotos(eventId, event.newPhotos, positions);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['nearby'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Comments and organizer updates
// ---------------------------------------------------------------------------

export function useEventComments(eventId: string) {
  return useQuery({
    queryKey: ['comments', eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('event_comments', { p_event: eventId });
      if (error) throw error;
      return data as EventComment[];
    },
  });
}

export function usePostComment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, replyTo }: { body: string; replyTo?: string }) => {
      const { error } = await supabase.rpc('post_comment', { p_event: eventId, p_body: body.trim(), p_reply_to: replyTo });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', eventId] }),
  });
}

export function useDeleteComment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.rpc('delete_comment', { p_comment: commentId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', eventId] }),
  });
}

export function useEventUpdates(eventId: string) {
  return useQuery({
    queryKey: ['updates', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_updates')
        .select('id, body, created_at, edited_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePostUpdate(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('event_updates').insert({ event_id: eventId, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['updates', eventId] }),
  });
}

export function useDeleteUpdate(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updateId: string) => {
      const { error } = await supabase.from('event_updates').delete().eq('id', updateId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['updates', eventId] }),
  });
}
