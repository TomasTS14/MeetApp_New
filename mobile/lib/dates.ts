export type DateFilter = 'any' | 'today' | 'weekend' | 'week';

export const dateFilters: DateFilter[] = ['any', 'today', 'weekend', 'week'];

// The window of start times each date filter covers, from now.
export function dateFilterRange(filter: DateFilter, now = new Date()): { from: Date; to: Date | null } {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

  switch (filter) {
    case 'today':
      return { from: now, to: addDays(startOfDay(now), 1) };
    case 'weekend': {
      // Saturday and Sunday of this week; if it is already the weekend, from now.
      const day = now.getDay(); // 0 Sunday … 6 Saturday
      const saturday = day === 0 ? addDays(startOfDay(now), -1) : addDays(startOfDay(now), 6 - day);
      const monday = addDays(saturday, 2);
      return { from: now > saturday ? now : saturday, to: monday };
    }
    case 'week':
      return { from: now, to: addDays(startOfDay(now), 8) };
    default:
      return { from: now, to: null };
  }
}

export function formatEventDate(iso: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// "5 minutes ago", "yesterday", "3 days ago" in the app's language.
export function formatRelative(iso: string, language: string, now = new Date()) {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
}
