import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

// The public web address of the app, e.g. https://meetapp.es. Shared links point there
// so they open for anyone, with or without the app. Falls back to this app's own link.
const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');

export function eventLink(eventId: string) {
  if (webUrl) return `${webUrl}/event/${eventId}`;
  if (Platform.OS === 'web') return `${window.location.origin}/event/${eventId}`;
  return Linking.createURL(`/event/${eventId}`);
}

// Opens the share sheet where there is one; otherwise copies the link.
export async function shareEvent(eventId: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = eventLink(eventId);
  if (Platform.OS !== 'web') {
    const result = await Share.share(Platform.OS === 'ios' ? { url, message: title } : { message: `${title}\n${url}` });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  address: string | null;
  area_label: string;
};

// Events without an end time are shown as two hours long in calendars.
export function eventEnd(event: CalendarEvent) {
  return event.ends_at ? new Date(event.ends_at) : new Date(new Date(event.starts_at).getTime() + 2 * 3600 * 1000);
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
}

// An iCalendar file with one event (RFC 5545), which every calendar app can import.
export function eventIcs(event: CalendarEvent) {
  const url = eventLink(event.id);
  const description = [event.description, url].filter(Boolean).join('\n\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MeetApp//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@meetapp`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(new Date(event.starts_at))}`,
    `DTEND:${icsDate(eventEnd(event))}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(description)}`,
    `LOCATION:${icsText(event.address ?? event.area_label)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
