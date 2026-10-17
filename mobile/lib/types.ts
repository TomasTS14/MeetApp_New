import type { Database } from '@/lib/database.types';

export type EventCategory = Database['public']['Enums']['event_category'];
export type RsvpStatus = Database['public']['Enums']['rsvp_status'];

export const eventCategories: EventCategory[] = [
  'music',
  'sport',
  'food',
  'nightlife',
  'culture',
  'outdoors',
  'learning',
  'social',
  'other',
];

type Functions = Database['public']['Functions'];

// The generated types mark every function column as non-null; these are the ones that
// can be null, so the screens have to handle them.
type WithNullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export type NearbyEvent = WithNullable<
  Functions['nearby_events']['Returns'][number],
  'ends_at' | 'max_participants' | 'cover_photo_path' | 'my_rsvp'
>;

export type EventDetails = WithNullable<
  Functions['get_event']['Returns'][number],
  'ends_at' | 'max_participants' | 'address' | 'cancelled_at' | 'my_rsvp' | 'organizer_name'
>;

export type MyEvent = WithNullable<
  Functions['my_events']['Returns'][number],
  'ends_at' | 'cancelled_at' | 'cover_photo_path'
>;
