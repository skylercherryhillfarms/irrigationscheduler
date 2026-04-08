'use client';

import { prevWeek, nextWeek, formatWeekRange } from '@/lib/dates';

interface Props {
  weekStart: string;
  onChange: (week: string) => void;
}

export default function WeekNav({ weekStart, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(prevWeek(weekStart))}
        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors text-gray-600"
        title="Previous week"
      >
        ‹
      </button>

      <div className="text-center">
        <div className="font-semibold text-gray-800 text-sm sm:text-base">
          {formatWeekRange(weekStart)}
        </div>
      </div>

      <button
        onClick={() => onChange(nextWeek(weekStart))}
        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors text-gray-600"
        title="Next week"
      >
        ›
      </button>

      <button
        onClick={() => {
          const { format, startOfWeek } = require('date-fns');
          const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
          onChange(format(monday, 'yyyy-MM-dd'));
        }}
        className="px-3 py-1.5 text-xs rounded-md border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors hidden sm:block"
      >
        Today
      </button>
    </div>
  );
}
