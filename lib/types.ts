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
  position: number | null;
  created_at: string;
}

export type Shift = 'AM' | 'PM' | 'Both';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = typeof DAYS[number];

export const LOCATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Charlies: { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300'  },
  Alpine:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300'   },
  Genola:   { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300'  },
  NF:       { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  NFE:      { bg: 'bg-rose-100',   text: 'text-rose-800',   border: 'border-rose-300'   },
  Smiths:   { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-300'   },
};

export function getLocationColor(location: string) {
  return LOCATION_COLORS[location] ?? { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
}

const GROUPING_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  pink:    { bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-300'   },
  rose:    { bg: 'bg-rose-100',   text: 'text-rose-800',   border: 'border-rose-300'   },
  red:     { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300'    },
  orange:  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  amber:   { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300'  },
  yellow:  { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  lime:    { bg: 'bg-lime-100',   text: 'text-lime-800',   border: 'border-lime-300'   },
  green:   { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300'  },
  teal:    { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-300'   },
  cyan:    { bg: 'bg-cyan-100',   text: 'text-cyan-800',   border: 'border-cyan-300'   },
  blue:    { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300'   },
  indigo:  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  violet:  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  purple:  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  fuchsia: { bg: 'bg-fuchsia-100',text: 'text-fuchsia-800',border: 'border-fuchsia-300'},
  white:   { bg: 'bg-gray-50',    text: 'text-gray-500',   border: 'border-gray-200'   },
  gray:    { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300'   },
  black:   { bg: 'bg-gray-800',   text: 'text-white',      border: 'border-gray-900'   },
};

export function getGroupingColor(grouping: string): { bg: string; text: string; border: string } | null {
  return GROUPING_COLOR_MAP[grouping.trim().toLowerCase()] ?? null;
}
