'use client';

import { useState } from 'react';
import { SheetRow } from '@/lib/types';
import { DAYS } from '@/lib/types';

const NOTE_PRESETS = ['Fertilize', 'Iron', 'Pesticide', 'Check valves', 'Flush lines', 'Maintenance'];

interface Props {
  sets: SheetRow[];
  dayIndex?: number;
  weekStart: string;
  defaultShift?: 'AM' | 'PM' | 'Both';
  onConfirm: (dayIndex: number, shift: 'AM' | 'PM' | 'Both', notes: string) => void;
  onClose: () => void;
}

export default function ScheduleModal({ sets, dayIndex, weekStart, defaultShift, onConfirm, onClose }: Props) {
  const [shift, setShift] = useState<'AM' | 'PM' | 'Both'>(defaultShift ?? 'AM');
  const [notes, setNotes] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(dayIndex ?? null);

  const needsDayPicker = dayIndex === undefined;

  const handlePreset = (p: string) => {
    setNotes((prev) => {
      if (prev.includes(p)) return prev.replace(p, '').replace(/,\s*,/, ',').replace(/^,\s*|,\s*$/, '').trim();
      return prev ? `${prev}, ${p}` : p;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ backgroundColor: '#27500A' }} className="text-white px-5 py-4 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-lg">Schedule Sets</div>
              <div className="text-green-200 text-sm">
                {selectedDay !== null ? DAYS[selectedDay] : 'Pick a day'} • {sets.length} set{sets.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button onClick={onClose} className="text-green-200 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Sets preview */}
          <div className="max-h-32 overflow-y-auto space-y-1">
            {sets.map((s) => (
              <div key={s.setName} className="flex items-center gap-2 text-sm text-gray-700 py-0.5">
                <span className="text-green-600">•</span>
                <span className="font-medium">{s.setName}</span>
                <span className="text-gray-400 text-xs">{s.location}</span>
              </div>
            ))}
          </div>

          {/* Day picker — only shown when opened from mobile button */}
          {needsDayPicker && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Day</label>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(i)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-colors border-2 ${
                      selectedDay === i
                        ? 'border-green-600 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Shift selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Shift</label>
            <div className="grid grid-cols-3 gap-2">
              {(['AM', 'PM', 'Both'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setShift(s)}
                  className={`py-2.5 rounded-lg font-semibold text-sm transition-colors border-2 ${
                    shift === s
                      ? s === 'AM'
                        ? 'bg-sky-100 text-sky-800 border-sky-500'
                        : s === 'PM'
                        ? 'bg-orange-100 text-orange-800 border-orange-500'
                        : 'bg-purple-100 text-purple-800 border-purple-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes presets */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Treatment Notes (optional)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {NOTE_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePreset(p)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    notes.includes(p)
                      ? 'bg-purple-100 text-purple-800 border-purple-400'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Custom note…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (selectedDay !== null) onConfirm(selectedDay, shift, notes); }}
              disabled={selectedDay === null}
              style={{ backgroundColor: '#27500A' }}
              className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-default"
            >
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
