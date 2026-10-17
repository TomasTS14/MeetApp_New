import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { EventCategory, EventDetails, MyEvent, NearbyEvent, RsvpStatus } from '@/lib/types';

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
  photos: { uri: string; mimeType: string }[];
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
        })
        .select('id')
        .single();
      if (error) throw error;

      // Photos go under the event's folder; the first one is the cover.
      for (const [position, photo] of event.photos.entries()) {
        const body = await (await fetch(photo.uri)).arrayBuffer();
        const extension = photo.mimeType.split('/')[1] ?? 'jpg';
        const path = `${data.id}/${position}-${Date.now()}.${extension}`;
        const upload = await supabase.storage
          .from('event-photos')
          .upload(path, body, { contentType: photo.mimeType });
        if (upload.error) throw upload.error;
        const row = await supabase
          .from('event_photos')
          .insert({ event_id: data.id, storage_path: path, position });
        if (row.error) throw row.error;
      }
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
    },
  });
}
