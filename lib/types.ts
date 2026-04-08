export interface SheetRow {
  location: string;
  setName: string;
  grouping: string;
  acres: number | null;
  gpm: number | null;
  block: string;
  blockDescription: string;
}

export interface ScheduleEntry {
  id: string;
  week_start: string; // YYYY-MM-DD (Monday)
  set_name: string;
  location: string;
  grouping: string;
  acres: number | null;
  gpm: number | null;
  day_of_week: number; // 0=Mon … 6=Sun
  shift: 'AM' | 'PM' | 'Both';
  notes: string;
  created_at: string;
}

export type Shift = 'AM' | 'PM' | 'Both';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = typeof DAYS[number];

export const LOCATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Charlies: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  Alpine:   { bg: 'bg-blue-100',  text: 'text-blue-800',  border: 'border-blue-300'  },
  Genola:   { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
};

export function getLocationColor(location: string) {
  return LOCATION_COLORS[location] ?? { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
}
