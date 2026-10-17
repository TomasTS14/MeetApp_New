import { saveTextFile } from '@/lib/saveFile';
import { eventIcs, type CalendarEvent } from '@/lib/share';

// Downloads an .ics file, which the browser hands to the person's calendar app.
export async function addToCalendar(event: CalendarEvent) {
  const name = event.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'event';
  await saveTextFile(`${name}.ics`, eventIcs(event), 'text/calendar;charset=utf-8');
}
