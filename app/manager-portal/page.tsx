'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NavBar from '@/components/NavBar';
import ScheduleModal from '@/components/ScheduleModal';
import { ScheduleEntry, SheetRow, getLocationColor, getGroupingColor, DAYS } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { getWeekStart, getWeekDays, prevWeek, nextWeek, formatWeekRange } from '@/lib/dates';
import { format } from 'date-fns';

type DragState = {
  sets: SheetRow[];
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
};

export default function ManagerPortalPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [allSets, setAllSets] = useState<SheetRow[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [setsLoading, setSetsLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [copyLocation, setCopyLocation] = useState('');

  // Modal state
  const [modal, setModal] = useState<{ dayIndex: number; defaultShift?: 'AM' | 'PM' | 'Both' } | null>(null);

  // Drag state
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragOverShift, setDragOverShift] = useState<{ dayIndex: number; shift: 'AM' | 'PM' } | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Fetch sets from Google Sheet
  const loadSets = useCallback((force = false) => {
    setSetsLoading(true);
    fetch(force ? '/api/sets?refresh=1' : '/api/sets')
      .then((r) => r.json())
      .then((data) => { setAllSets(Array.isArray(data) ? data : []); setSetsLoading(false); })
      .catch(() => setSetsLoading(false));
  }, []);

  useEffect(() => { loadSets(); }, [loadSets]);

  // Fetch schedule for current week
  const loadSchedule = useCallback(() => {
    setScheduleLoading(true);
    fetch(`/api/schedule?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data) => { setEntries(Array.isArray(data) ? data : []); setScheduleLoading(false); })
      .catch(() => setScheduleLoading(false));
  }, [weekStart]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // Realtime: reload when another user changes schedule_entries for this week
  useEffect(() => {
    const channel = supabase
      .channel(`manager-schedule-${weekStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_entries' }, () => {
        loadSchedule();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weekStart, loadSchedule]);

  // Groups and locations for filters
  const locations = useMemo(() => [...new Set(allSets.map((s) => s.location.trim()).filter(Boolean))].sort(), [allSets]);
  const groups = useMemo(() => {
    const source = filterLocation ? allSets.filter((s) => s.location.trim() === filterLocation) : allSets;
    return [...new Set(source.map((s) => s.grouping.trim()).filter(Boolean))].sort();
  }, [allSets, filterLocation]);

  // Filtered sidebar sets
  const filteredSets = useMemo(() => {
    return allSets.filter((s) => {
      if (search && !s.setName.toLowerCase().includes(search.toLowerCase()) && !s.location.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGroup && s.grouping.trim() !== filterGroup) return false;
      if (filterLocation && s.location.trim() !== filterLocation) return false;
      return true;
    });
  }, [allSets, search, filterGroup, filterLocation]);

  // Unique key per set (set names are not unique across locations)
  const setKey = (s: SheetRow) => `${s.location}::${s.setName}`;

  // Toggle select a set
  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filteredSets.map(setKey)));
  const clearAll = () => setSelected(new Set());

  // Get sets to schedule: if dragging a set that's in selection, use selection; otherwise just that set
  const getSetsToSchedule = (draggedKey: string): SheetRow[] => {
    if (selected.has(draggedKey) && selected.size > 1) {
      return allSets.filter((s) => selected.has(setKey(s)));
    }
    return allSets.filter((s) => setKey(s) === draggedKey);
  };

  // --- Drag handlers ---
  const handleDragStart = (e: React.DragEvent, key: string) => {
    const setsToSchedule = getSetsToSchedule(key);
    e.dataTransfer.setData('sets', JSON.stringify(setsToSchedule));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    setDragOverDay(null);
    let setsToSchedule: SheetRow[] = [];
    try {
      setsToSchedule = JSON.parse(e.dataTransfer.getData('sets'));
    } catch { return; }
    if (setsToSchedule.length === 0) return;
    // Open modal
    setModal({ dayIndex });
    dragRef.current = { sets: setsToSchedule, startX: 0, startY: 0, currentX: 0, currentY: 0, active: false };
  };

  const handleDragOver = (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverDay(dayIndex);
  };

  const handleModalConfirm = async (dayIndex: number, shift: 'AM' | 'PM' | 'Both', notes: string) => {
    const setsToSchedule = dragRef.current?.sets ?? [];
    if (setsToSchedule.length === 0) { setModal(null); return; }

    const toInsert = setsToSchedule.map((s) => ({
      week_start: weekStart,
      set_name: s.setName,
      location: s.location,
      grouping: s.grouping ?? '',
      acres: s.acres,
      gpm: s.gpm,
      day_of_week: dayIndex,
      shift,
      notes: notes.trim(),
    }));

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toInsert),
      });
      if (res.ok) {
        loadSchedule();
        setModal(null);
        dragRef.current = null;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
    loadSchedule();
  };

  const handleMoveEntry = async (id: string, dayIndex: number, shift: 'AM' | 'PM') => {
    await fetch(`/api/schedule?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day_of_week: dayIndex, shift }),
    });
    loadSchedule();
  };

  const handleDropOnShift = (e: React.DragEvent, dayIndex: number, shift: 'AM' | 'PM') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverShift(null);
    setDragOverDay(null);

    // Existing scheduled entry being moved
    const entryData = e.dataTransfer.getData('existingEntry');
    if (entryData) {
      try {
        const entry: ScheduleEntry = JSON.parse(entryData);
        handleMoveEntry(entry.id, dayIndex, shift);
      } catch {}
      return;
    }

    // Sidebar set being dropped — open modal with shift pre-filled
    let setsToSchedule: SheetRow[] = [];
    try { setsToSchedule = JSON.parse(e.dataTransfer.getData('sets')); } catch { return; }
    if (setsToSchedule.length === 0) return;
    setModal({ dayIndex, defaultShift: shift });
    dragRef.current = { sets: setsToSchedule, startX: 0, startY: 0, currentX: 0, currentY: 0, active: false };
  };

  const handleCopyWeek = async () => {
    if (!copyLocation) { setCopyMsg('Select a location to copy'); return; }
    setCopyLoading(true);
    setCopyMsg('');
    try {
      const res = await fetch('/api/schedule/copy-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, location: copyLocation }),
      });
      const data = await res.json();
      if (data.error) {
        setCopyMsg(`Error: ${data.error}`);
      } else {
        setCopyMsg(`✓ Copied ${data.count} entries to ${data.targetWeek}`);
        setTimeout(() => setCopyMsg(''), 4000);
      }
    } catch {
      setCopyMsg('Copy failed');
    } finally {
      setCopyLoading(false);
    }
  };

  // Lookup map: "location::setName" → SheetRow (for block/blockDescription)
  const setsMap = useMemo(() => {
    const map = new Map<string, SheetRow>();
    for (const s of allSets) map.set(`${s.location}::${s.setName}`, s);
    return map;
  }, [allSets]);

  // Build day → entries map, filtered by location if a filter is active
  const dayEntriesMap = useMemo(() => {
    const map = new Map<number, ScheduleEntry[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    const visible = filterLocation ? entries.filter((e) => e.location === filterLocation) : entries;
    for (const e of visible) {
      map.get(e.day_of_week)?.push(e);
    }
    return map;
  }, [entries, filterLocation]);

  // Totals per day per shift — sorted by location
  const getDayShiftEntries = (dayIndex: number, shift: 'AM' | 'PM') => {
    return (dayEntriesMap.get(dayIndex) ?? [])
      .filter((e) => e.shift === shift || e.shift === 'Both')
      .sort((a, b) => a.location.localeCompare(b.location));
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ backgroundColor: '#f8faf4' }}>
      <NavBar />

      {/* Page header */}
      <div style={{ backgroundColor: '#27500A' }} className="text-white px-4 py-4">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Manager Portal</h1>
            <p className="text-green-200 text-sm">Drag sets from sidebar onto day columns to schedule</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setWeekStart(prevWeek(weekStart))} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">‹</button>
            <span className="font-semibold">{formatWeekRange(weekStart)}</span>
            <button onClick={() => setWeekStart(nextWeek(weekStart))} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">›</button>
            <button onClick={() => setWeekStart(getWeekStart())} disabled={weekStart === getWeekStart()} className="px-3 py-1.5 text-xs rounded-md bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-default">Today</button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={copyLocation}
              onChange={(e) => setCopyLocation(e.target.value)}
              className="border border-white/30 rounded-lg px-2 py-2 text-sm bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="" className="text-gray-800">Select location…</option>
              {locations.map((l) => <option key={l} value={l} className="text-gray-800">{l}</option>)}
            </select>
            <button
              onClick={handleCopyWeek}
              disabled={copyLoading || !copyLocation}
              className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {copyLoading ? 'Copying…' : '📋 Copy to Next Week'}
            </button>
            {copyMsg && (
              <span className={`text-xs ${copyMsg.startsWith('Error') ? 'text-red-300' : 'text-green-200'}`}>
                {copyMsg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content: sidebar + calendar */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* SIDEBAR */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <input
              type="text"
              placeholder="Search sets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <div className="flex gap-2">
              <select
                value={filterLocation}
                onChange={(e) => { setFilterLocation(e.target.value); setFilterGroup(''); }}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="">All Locations</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="">All Groups</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-green-700 hover:underline">Select all</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => { clearAll(); setFilterLocation(''); setFilterGroup(''); setSearch(''); }} className="text-gray-500 hover:underline">Clear all</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => loadSets(true)} disabled={setsLoading} className="text-blue-600 hover:underline disabled:opacity-50" title="Re-fetch sets from Google Sheet">
                {setsLoading ? 'Loading…' : '↻ Refresh'}
              </button>
              {selected.size > 0 && (
                <span className="ml-auto text-green-700 font-semibold">{selected.size} selected</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {setsLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading sets…</div>
            ) : filteredSets.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No sets found</div>
            ) : (
              filteredSets.map((s) => {
                const colors = getLocationColor(s.location);
                const key = setKey(s);
                const isSelected = selected.has(key);
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, key)}
                    onClick={() => toggleSelect(key)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors select-none ${
                      isSelected
                        ? 'bg-green-50 border border-green-300'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(key)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded accent-green-700 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800 truncate">{s.setName}</span>
                        <span className={`flex-shrink-0 text-[10px] px-1.5 py-0 rounded-full border leading-tight ${colors.bg} ${colors.text} ${colors.border}`}>
                          {s.location}
                        </span>
                        {s.grouping && (() => {
                          const gc = getGroupingColor(s.grouping);
                          return gc
                            ? <span className={`flex-shrink-0 text-[10px] px-1.5 py-0 rounded-full border leading-tight ${gc.bg} ${gc.text} ${gc.border}`}>{s.grouping}</span>
                            : <span className="flex-shrink-0 text-[10px] text-gray-400">{s.grouping}</span>;
                        })()}
                      </div>
                      {(s.block || s.blockDescription) && (
                        <div className="text-[10px] text-gray-400 truncate leading-tight mt-0.5">
                          {[s.block, s.blockDescription].filter(Boolean).join(' – ')}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0 text-right">
                      {s.location === 'Genola' && s.gpm != null && <div>{s.gpm} GPM</div>}
                      {s.location === 'Charlies' && s.acres != null && <div>{s.acres} ac</div>}
                    </div>
                    <div className="text-gray-300 flex-shrink-0">⠿</div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* CALENDAR */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-[900px] h-full flex gap-1 p-2">
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const dayDate = weekDays[dayIndex];
              const isOver = dragOverDay === dayIndex;
              const amEntries = getDayShiftEntries(dayIndex, 'AM');
              const pmEntries = getDayShiftEntries(dayIndex, 'PM');

              // Totals
              const genolaGPM_AM = amEntries.filter((e) => e.location === 'Genola').reduce((sum, e) => sum + (e.gpm ?? 0), 0);
              const genolaGPM_PM = pmEntries.filter((e) => e.location === 'Genola').reduce((sum, e) => sum + (e.gpm ?? 0), 0);
              const charliesAcres_AM = amEntries.filter((e) => e.location === 'Charlies').reduce((sum, e) => sum + (e.acres ?? 0), 0);
              const charliesAcres_PM = pmEntries.filter((e) => e.location === 'Charlies').reduce((sum, e) => sum + (e.acres ?? 0), 0);

              return (
                <div
                  key={dayIndex}
                  className={`flex-1 min-w-[120px] flex flex-col bg-white rounded-xl border transition-colors ${
                    isOver ? 'border-green-500 ring-2 ring-green-400 bg-green-50' : 'border-gray-200'
                  }`}
                  onDragOver={(e) => handleDragOver(e, dayIndex)}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(e) => handleDrop(e, dayIndex)}
                >
                  {/* Day header */}
                  <div
                    style={{ backgroundColor: '#27500A' }}
                    className="text-white text-center py-2 px-1 rounded-t-xl"
                  >
                    <div className="font-bold text-sm">{DAYS[dayIndex]}</div>
                    <div className="text-green-200 text-xs">{format(dayDate, 'MMM d')}</div>
                  </div>

                  {scheduleLoading ? (
                    <div className="flex-1 flex items-center justify-center text-gray-300 text-xs">…</div>
                  ) : (
                    <div className="flex-1 flex flex-col overflow-y-auto p-1 gap-1">
                      {/* AM drop zone */}
                      <div
                        onDrop={(e) => handleDropOnShift(e, dayIndex, 'AM')}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverShift({ dayIndex, shift: 'AM' }); }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverShift(null); }}
                        className={`min-h-[32px] rounded-lg transition-colors ${dragOverShift?.dayIndex === dayIndex && dragOverShift?.shift === 'AM' ? 'bg-sky-50 ring-1 ring-sky-300' : ''}`}
                      >
                        <ShiftSection
                          label="AM"
                          entries={amEntries}
                          onDelete={handleDeleteEntry}
                          gpmTotal={genolaGPM_AM > 0 ? genolaGPM_AM : null}
                          acresTotal={charliesAcres_AM > 0 ? charliesAcres_AM : null}
                          setsMap={setsMap}
                        />
                      </div>
                      {/* PM drop zone */}
                      <div
                        onDrop={(e) => handleDropOnShift(e, dayIndex, 'PM')}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverShift({ dayIndex, shift: 'PM' }); }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverShift(null); }}
                        className={`min-h-[32px] rounded-lg transition-colors ${dragOverShift?.dayIndex === dayIndex && dragOverShift?.shift === 'PM' ? 'bg-orange-50 ring-1 ring-orange-300' : ''}`}
                      >
                        <ShiftSection
                          label="PM"
                          entries={pmEntries}
                          onDelete={handleDeleteEntry}
                          gpmTotal={genolaGPM_PM > 0 ? genolaGPM_PM : null}
                          acresTotal={charliesAcres_PM > 0 ? charliesAcres_PM : null}
                          setsMap={setsMap}
                        />
                      </div>

                      {amEntries.length === 0 && pmEntries.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-gray-300 text-xs py-4">
                          Drop sets here
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && dragRef.current && (
        <ScheduleModal
          sets={dragRef.current.sets}
          dayIndex={modal.dayIndex}
          weekStart={weekStart}
          defaultShift={modal.defaultShift}
          onConfirm={handleModalConfirm}
          onClose={() => { setModal(null); dragRef.current = null; }}
        />
      )}
    </div>
  );
}

function ShiftSection({
  label,
  entries,
  onDelete,
  gpmTotal,
  acresTotal,
  setsMap,
}: {
  label: 'AM' | 'PM';
  entries: ScheduleEntry[];
  onDelete: (id: string) => void;
  gpmTotal: number | null;
  acresTotal: number | null;
  setsMap: Map<string, SheetRow>;
}) {
  const labelStyle =
    label === 'AM'
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
          return (
            <div
              key={e.id}
              draggable
              onDragStart={(ev) => {
                ev.stopPropagation();
                ev.dataTransfer.setData('existingEntry', JSON.stringify(e));
                ev.dataTransfer.effectAllowed = 'move';
              }}
              className="flex items-center gap-1.5 bg-gray-50 rounded px-1.5 py-0.5 group overflow-hidden cursor-grab active:cursor-grabbing"
              title={fullTitle}
            >
              <span className={`flex-shrink-0 text-[10px] px-1 rounded-full border leading-tight ${colors.bg} ${colors.text} ${colors.border}`}>
                {e.location}
              </span>
              <span className="flex-shrink-0 text-xs font-medium text-gray-800">{e.set_name}</span>
              {block && (
                <span className="flex-shrink-0 text-[10px] text-gray-400">{block}</span>
              )}
              {blockDesc && (
                <span className="text-[10px] text-gray-400 truncate min-w-0">{blockDesc}</span>
              )}
              {e.notes?.trim() && (
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-400" title={e.notes} />
              )}
              <button
                onClick={() => onDelete(e.id)}
                className="flex-shrink-0 ml-auto text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-sm leading-none"
                title="Remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {/* Totals */}
      {(gpmTotal !== null || acresTotal !== null) && (
        <div className="px-2 py-1 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 font-medium">
          {gpmTotal !== null && <span className="text-amber-700">⚡ {gpmTotal.toFixed(0)} GPM (Genola)</span>}
          {acresTotal !== null && <span className="text-green-700">🌿 {acresTotal.toFixed(1)} ac (Charlies)</span>}
        </div>
      )}
    </div>
  );
}
