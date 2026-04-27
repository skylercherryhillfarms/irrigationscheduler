'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import NavBar from '@/components/NavBar';
import { ScheduleEntry, SheetRow, getLocationColor, getGroupingColor, DAYS } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { getWeekStart, getWeekDays, prevWeek, nextWeek, formatWeekRange } from '@/lib/dates';
import { format } from 'date-fns';

export default function MasterSchedulePage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [sets, setSets] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState('');
  const [search, setSearch] = useState('');

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  useEffect(() => {
    fetch('/api/sets').then((r) => r.json()).then(setSets).catch(console.error);
  }, []);

  const loadSchedule = useCallback(() => {
    setLoading(true);
    fetch(`/api/schedule?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data) => { setEntries(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [weekStart]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // Realtime: reflect changes made by other managers immediately
  useEffect(() => {
    const channel = supabase
      .channel(`master-schedule-${weekStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_entries' }, () => {
        loadSchedule();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weekStart, loadSchedule]);

  // Lookup map: "location::setName" → SheetRow (for block/blockDescription)
  const setsMap = useMemo(() => {
    const map = new Map<string, SheetRow>();
    for (const s of sets) map.set(`${s.location}::${s.setName}`, s);
    return map;
  }, [sets]);

  const locations = useMemo(() => [...new Set(entries.map((e) => e.location).filter(Boolean))].sort(), [entries]);

  // Filter entries by location + search
  const visibleEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filterLocation && e.location !== filterLocation) return false;
      if (search && !e.set_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterLocation, search]);

  // Build day → entries map from visible entries
  const dayEntriesMap = useMemo(() => {
    const map = new Map<number, ScheduleEntry[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const e of visibleEntries) map.get(e.day_of_week)?.push(e);
    return map;
  }, [visibleEntries]);

  const getDayShiftEntries = (dayIndex: number, shift: 'AM' | 'PM') =>
    (dayEntriesMap.get(dayIndex) ?? [])
      .filter((e) => e.shift === shift || e.shift === 'Both')
      .sort((a, b) => a.location.localeCompare(b.location));

  // Stats based on visible entries
  const stats = useMemo(() => {
    const setsCount = new Set(visibleEntries.map((e) => `${e.location}::${e.set_name}`)).size;
    const amSlots = visibleEntries.filter((e) => e.shift === 'AM' || e.shift === 'Both').length;
    const pmSlots = visibleEntries.filter((e) => e.shift === 'PM' || e.shift === 'Both').length;
    const notes = visibleEntries.filter((e) => e.notes?.trim()).length;
    return { setsCount, amSlots, pmSlots, notes };
  }, [visibleEntries]);

  return (
    <>
    <style>{`
      @media print {
        @page { size: landscape; margin: 0.4in; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print { display: none !important; }
        html, body { height: auto !important; overflow: visible !important; }
        .print-root { height: auto !important; overflow: visible !important; }
        .print-scroll { height: auto !important; overflow: visible !important; flex: none !important; }
        .print-sticky { position: static !important; }
      }
    `}</style>
    <div className="h-screen overflow-hidden flex flex-col print-root" style={{ backgroundColor: '#f8faf4' }}>
      <div className="no-print"><NavBar /></div>

      {/* Screen-only header */}
      <div style={{ backgroundColor: '#27500A' }} className="no-print text-white px-4 py-4">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Master Schedule</h1>
            <p className="text-green-200 text-sm">Read-only view of all scheduled sets</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setWeekStart(prevWeek(weekStart))} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">‹</button>
            <span className="font-semibold">{formatWeekRange(weekStart)}</span>
            <button onClick={() => setWeekStart(nextWeek(weekStart))} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">›</button>
            <button onClick={() => setWeekStart(getWeekStart())} disabled={weekStart === getWeekStart()} className="px-3 py-1.5 text-xs rounded-md bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-default">Today</button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search sets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-white/30 rounded-lg px-3 py-1.5 text-sm bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 w-full sm:w-40"
            />
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="border border-white/30 rounded-lg px-2 py-1.5 text-sm bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="" className="text-gray-800">All Locations</option>
              {locations.map((l) => <option key={l} value={l} className="text-gray-800">{l}</option>)}
            </select>
            {(filterLocation || search) && (
              <button onClick={() => { setFilterLocation(''); setSearch(''); }} className="text-xs text-white/70 hover:text-white underline">
                Clear
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/20 hover:bg-white/30 transition-colors font-medium"
            >
              🖨 Print
            </button>
          </div>
        </div>
      </div>

      {/* Print-only title */}
      <div className="hidden print:block px-2 pt-2 pb-1">
        <div className="text-lg font-bold">Cherry Hill Farms — Master Schedule</div>
        <div className="text-sm text-gray-600">{formatWeekRange(weekStart)}{filterLocation ? ` · ${filterLocation}` : ''}</div>
      </div>


      {/* Calendar */}
      <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 print-scroll">
        <div className="min-w-[900px] flex gap-1 p-2 items-start print:min-w-0 print:p-0 print:gap-0.5">
          {Array.from({ length: 7 }, (_, dayIndex) => {
            const dayDate = weekDays[dayIndex];
            const amEntries = getDayShiftEntries(dayIndex, 'AM');
            const pmEntries = getDayShiftEntries(dayIndex, 'PM');

            return (
              <div key={dayIndex} className="flex-1 min-w-[120px] flex flex-col bg-white rounded-xl border border-gray-200">
                {/* Day header */}
                <div style={{ backgroundColor: '#27500A' }} className="text-white text-center py-2 px-1 rounded-t-xl sticky top-0 z-10 print-sticky">
                  <div className="font-bold text-sm">{DAYS[dayIndex]}</div>
                  <div className="text-green-200 text-xs">{format(dayDate, 'MMM d')}</div>
                </div>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center text-gray-300 text-xs">…</div>
                ) : (
                  <div className="flex flex-col p-1 gap-1">
                    <ShiftSection label="AM" entries={amEntries} setsMap={setsMap} />
                    <ShiftSection label="PM" entries={pmEntries} setsMap={setsMap} />
                    {amEntries.length === 0 && pmEntries.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-gray-300 text-xs py-4">—</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}

function ShiftSection({
  label,
  entries,
  setsMap,
}: {
  label: 'AM' | 'PM';
  entries: ScheduleEntry[];
  setsMap: Map<string, SheetRow>;
}) {
  const labelStyle = label === 'AM'
    ? 'bg-sky-100 text-sky-700 border-sky-200'
    : 'bg-orange-100 text-orange-700 border-orange-200';

  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-100 overflow-hidden">
      <div className={`text-xs font-bold px-2 py-0.5 border-b ${labelStyle}`}>{label}</div>
      <div className="space-y-px p-1">
        {entries.map((e) => {
          const colors = getLocationColor(e.location);
          const setInfo = setsMap.get(`${e.location}::${e.set_name}`);
          const block = setInfo?.block ?? '';
          const blockDesc = setInfo?.blockDescription ?? '';
          const fullTitle = [e.set_name, block, blockDesc, e.notes].filter(Boolean).join(' · ');
          const isVenueEvent = e.set_name.toLowerCase().includes('venue event');
          return (
            <div
              key={e.id}
              className={`rounded px-1.5 py-0.5 flex items-center gap-1.5 overflow-hidden ${isVenueEvent ? 'border border-yellow-400/50' : 'bg-gray-50'}`}
              style={isVenueEvent ? { background: 'radial-gradient(circle at 15% 50%, rgba(255,215,0,0.4) 0%, transparent 45%), radial-gradient(circle at 80% 20%, rgba(255,80,180,0.35) 0%, transparent 40%), radial-gradient(circle at 55% 85%, rgba(100,180,255,0.3) 0%, transparent 35%), #0d0a1e' } : undefined}
              title={fullTitle}
            >
              {isVenueEvent && <span className="flex-shrink-0 text-xs">🎆</span>}
              <span className={`flex-shrink-0 text-[10px] px-1 rounded-full border leading-tight ${colors.bg} ${colors.text} ${colors.border}`}>
                {e.location}
              </span>
              <span className={`flex-shrink-0 text-xs font-medium ${isVenueEvent ? 'text-yellow-100' : 'text-gray-800'}`}>{e.set_name}</span>
              {e.grouping && e.location !== 'Genola' && (() => {
                const gc = getGroupingColor(e.grouping);
                return gc
                  ? <span className={`flex-shrink-0 text-[10px] px-1.5 py-0 rounded-full border leading-tight ${gc.bg} ${gc.text} ${gc.border}`}>{e.grouping}</span>
                  : <span className="flex-shrink-0 text-[10px] text-gray-400">{e.grouping}</span>;
              })()}
              {block && (
                <span className={`flex-shrink-0 text-[10px] ${isVenueEvent ? 'text-yellow-300/70' : 'text-gray-400'}`}>{block}</span>
              )}
              {blockDesc && (
                <span className={`text-[10px] truncate min-w-0 ${isVenueEvent ? 'text-yellow-300/70' : 'text-gray-400'}`}>{blockDesc}</span>
              )}
              {e.notes?.trim() && (
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-bold text-lg ${color}`}>{value}</span>
      <span className="text-gray-600">{label}</span>
    </div>
  );
}
