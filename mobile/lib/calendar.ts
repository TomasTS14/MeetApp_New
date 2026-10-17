import { createEventInCalendarAsync } from 'expo-calendar/legacy';

import { eventEnd, eventLink, type CalendarEvent } from '@/lib/share';

// Opens the phone's own "new event" screen, filled in. The person saves it there, so the
// app never needs access to their calendars.
export async function addToCalendar(event: CalendarEvent) {
  await createEventInCalendarAsync({
    title: event.title,
    startDate: new Date(event.starts_at),
    endDate: eventEnd(event),
    location: event.address ?? event.area_label,
    notes: [event.description, eventLink(event.id)].filter(Boolean).join('\n\n'),
    url: eventLink(event.id),
  });
}
