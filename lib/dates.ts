import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';

/** Returns the Monday of the week containing `date` as a YYYY-MM-DD string */
export function getWeekStart(date: Date = new Date()): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

/** Returns array of 7 Date objects Mon–Sun for the given weekStart string */
export function getWeekDays(weekStart: string): Date[] {
  const monday = new Date(weekStart + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function prevWeek(weekStart: string): string {
  return format(subWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd');
}

export function nextWeek(weekStart: string): string {
  return format(addWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd');
}

export function formatWeekRange(weekStart: string): string {
  const days = getWeekDays(weekStart);
  const start = format(days[0], 'MMM d');
  const end = format(days[6], 'MMM d, yyyy');
  return `${start} – ${end}`;
}
