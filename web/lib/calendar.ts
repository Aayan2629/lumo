// Calendar links with no personal data: title, time and address only.
const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function calendarUrl(title: string, start: Date, minutes: number, location: string) {
  const end = new Date(start.getTime() + minutes * 60_000);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${fmt(start)}/${fmt(end)}`, location, details: 'Booked through Lumo' });
  return `https://calendar.google.com/calendar/render?${q}`;
}
export function ics(title: string, start: Date, minutes: number, location: string, uid: string) {
  const end = new Date(start.getTime() + minutes * 60_000);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lumo//EN', 'BEGIN:VEVENT', `UID:${uid}@lumo`, `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${title}`, `LOCATION:${location}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
export const whenText = (d: Date) => new Date(d).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
