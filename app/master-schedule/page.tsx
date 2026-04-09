'use client';

import { useEffect, useState, useMemo } from 'react';
import NavBar from '@/components/NavBar';
import { ScheduleEntry, SheetRow, getLocationColor, DAYS } from '@/lib/types';
import { getWeekStart, getWeekDays, prevWeek, nextWeek, formatWeekRange } from '@/lib/dates';
import { format } from 'date-fns';

export default function MasterSchedulePage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [sets, setSets] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [search, setSearch] = useState('');

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  useEffect(() => {
    fetch('/api/sets').then((r) => r.json()).then(setSets).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/schedule?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data) => { setEntries(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [weekStart]);

  const locations = useMemo(() => [...new Set(entries.map((e) => e.location).filter(Boolean))].sort(), [entries]);

  // Build a map: setName → dayOfWeek → entries
  const scheduleMap = useMemo(() => {
    const map = new Map<string, Map<number, ScheduleEntry[]>>();
    for (const entry of entries) {
      if (!map.has(entry.set_name)) map.set(entry.set_name, new Map());
      const dayMap = map.get(entry.set_name)!;
      if (!dayMap.has(entry.day_of_week)) dayMap.set(entry.day_of_week, []);
      dayMap.get(entry.day_of_week)!.push(entry);
    }
    return map;
  }, [entries]);

  // Unique scheduled sets, filtered
  const scheduledSets = useMemo(() => {
    const unique = new Map<string, ScheduleEntry>();
    for (const entry of entries) {
      if (!unique.has(entry.set_name)) unique.set(entry.set_name, entry);
    }
    let result = [...unique.values()];
    if (filterLocation) result = result.filter((e) => e.location === filterLocation);
    if (filterDay !== '') result = result.filter((e) =>
      entries.some((en) => en.set_name === e.set_name && en.day_of_week === parseInt(filterDay))
    );
    if (search) result = result.filter((e) => e.set_name.toLowerCase().includes(search.toLowerCase()));
    return result.sort((a, b) => a.location.localeCompare(b.location) || a.set_name.localeCompare(b.set_name));
  }, [entries, filterLocation, filterDay, search]);

  // Stats
  const stats = useMemo(() => {
    const filtered = filterLocation ? entries.filter((e) => e.location === filterLocation) : entries;
    const setsCount = new Set(filtered.map((e) => e.set_name)).size;
    const amSlots = filtered.filter((e) => e.shift === 'AM' || e.shift === 'Both').length;
    const pmSlots = filtered.filter((e) => e.shift === 'PM' || e.shift === 'Both').length;
    const notes = filtered.filter((e) => e.notes?.trim()).length;
    return { setsCount, amSlots, pmSlots, notes };
  }, [entries, filterLocation]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8faf4' }}>
      <NavBar />

      {/* Header */}
      <div style={{ backgroundColor: '#27500A' }} className="text-white px-4 py-4">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-3">Master Schedule</h1>

          {/* Week navigation */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setWeekStart(prevWeek(weekStart))}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >‹</button>
            <span className="font-semibold text-lg">{formatWeekRange(weekStart)}</span>
            <button
              onClick={() => setWeekStart(nextWeek(weekStart))}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >›</button>
            <button
              onClick={() => setWeekStart(getWeekStart())}
              className="px-3 py-1.5 text-xs rounded-md bg-white/20 hover:bg-white/30 transition-colors"
            >Today</button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ backgroundColor: '#EAF3DE' }} className="border-b border-green-200 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap gap-4 text-sm">
          <Stat label="Sets Scheduled" value={stats.setsCount} color="text-green-800" />
          <Stat label="AM Slots" value={stats.amSlots} color="text-sky-700" />
          <Stat label="PM Slots" value={stats.pmSlots} color="text-orange-600" />
          <Stat label="Treatment Notes" value={stats.notes} color="text-purple-700" />
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-screen-2xl mx-auto w-full px-4 py-3 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search sets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 w-48"
        />
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="">All Locations</option>
          {locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="">All Days</option>
          {DAYS.map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
        {(filterLocation || filterDay || search) && (
          <button
            onClick={() => { setFilterLocation(''); setFilterDay(''); setSearch(''); }}
            className="text-sm text-red-600 hover:underline"
          >Clear filters</button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto px-4 pb-8">
        <div className="max-w-screen-2xl mx-auto">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading schedule…</div>
          ) : scheduledSets.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📅</div>
              <div className="font-medium">No sets scheduled this week</div>
              <div className="text-sm mt-1">Use the Manager Portal to add schedules</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ backgroundColor: '#27500A' }} className="text-white">
                    <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10" style={{ backgroundColor: '#27500A', minWidth: 200 }}>
                      Set / Location
                    </th>
                    {weekDays.map((d, i) => (
                      <th key={i} className="text-center px-3 py-3 font-semibold" style={{ minWidth: 110 }}>
                        <div>{DAYS[i]}</div>
                        <div className="text-green-200 text-xs font-normal">{format(d, 'MMM d')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduledSets.map((set, idx) => {
                    const colors = getLocationColor(set.location);
                    const dayMap = scheduleMap.get(set.set_name);
                    return (
                      <tr
                        key={set.set_name}
                        className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50 transition-colors`}
                      >
                        <td className="px-4 py-2.5 sticky left-0 z-10 bg-inherit">
                          <div className="font-medium text-gray-800 text-sm">{set.set_name}</div>
                          <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                            {set.location}
                          </span>
                          {set.grouping && (
                            <span className="ml-1 text-xs text-gray-400">{set.grouping}</span>
                          )}
                        </td>
                        {Array.from({ length: 7 }, (_, dayIdx) => {
                          const dayEntries = dayMap?.get(dayIdx) ?? [];
                          return (
                            <td key={dayIdx} className="px-2 py-2.5 text-center align-middle">
                              {dayEntries.length > 0 ? (
                                <div className="flex flex-col items-center gap-1">
                                  {dayEntries.map((entry) => (
                                    <div key={entry.id} className="flex flex-col items-center gap-0.5">
                                      <div className="flex gap-1 flex-wrap justify-center">
                                        {(entry.shift === 'AM' || entry.shift === 'Both') && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">AM</span>
                                        )}
                                        {(entry.shift === 'PM' || entry.shift === 'Both') && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">PM</span>
                                        )}
                                      </div>
                                      {entry.notes?.trim() && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200 max-w-[90px] truncate" title={entry.notes}>
                                          {entry.notes}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
