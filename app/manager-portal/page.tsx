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
  const [copyTargetWeek, setCopyTargetWeek] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-slot start times, keyed by `${dayIndex}-${shift}`
  const [slotTimes, setSlotTimes] = useState<Record<string, string>>({});
  const slotSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Sidebar open state (collapsed by default on mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{ dayIndex?: number; defaultShift?: 'AM' | 'PM' | 'Both' } | null>(null);

  // Drag state
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragOverShift, setDragOverShift] = useState<{ dayIndex: number; shift: 'AM' | 'PM' } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragStartedRef = useRef(false);
  const draggingEntryRef = useRef<ScheduleEntry | null>(null);
  const draggingGroupRef = useRef<string[] | null>(null);
  const scheduleLoadedWeekRef = useRef<string | null>(null);

  // Multi-select of already-scheduled calendar entries
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const toggleEntry = useCallback((id: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

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
    if (scheduleLoadedWeekRef.current !== weekStart) {
      setScheduleLoading(true);
    }
    fetch(`/api/schedule?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(Array.isArray(data) ? data : []);
        setScheduleLoading(false);
        scheduleLoadedWeekRef.current = weekStart;
      })
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

  // Fetch/clear location notes when filter changes
  useEffect(() => {
    if (!filterLocation) { setLocationNotes(''); return; }
    fetch(`/api/location-notes?location=${encodeURIComponent(filterLocation)}`)
      .then((r) => r.json())
      .then((d) => setLocationNotes(d.notes ?? ''))
      .catch(() => setLocationNotes(''));
  }, [filterLocation]);

  const handleNotesChange = (value: string) => {
    setLocationNotes(value);
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(async () => {
      setNotesSaving(true);
      await fetch('/api/location-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: filterLocation, notes: value }),
      });
      setNotesSaving(false);
    }, 1000);
  };

  // Clear entry selection when the week or location filter changes
  useEffect(() => { setSelectedEntries(new Set()); }, [weekStart, filterLocation]);

  // Fetch/clear slot start times when location or week changes
  useEffect(() => {
    if (!filterLocation) { setSlotTimes({}); return; }
    fetch(`/api/slot-times?location=${encodeURIComponent(filterLocation)}&weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, string> = {};
        for (const t of d.times ?? []) map[`${t.day_of_week}-${t.shift}`] = t.start_time ?? '';
        setSlotTimes(map);
      })
      .catch(() => setSlotTimes({}));
  }, [filterLocation, weekStart]);

  const handleSlotTimeChange = (dayIndex: number, shift: 'AM' | 'PM', value: string) => {
    const key = `${dayIndex}-${shift}`;
    setSlotTimes((prev) => ({ ...prev, [key]: value }));
    if (slotSaveTimers.current[key]) clearTimeout(slotSaveTimers.current[key]);
    slotSaveTimers.current[key] = setTimeout(() => {
      fetch('/api/slot-times', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: filterLocation, weekStart, dayOfWeek: dayIndex, shift, startTime: value }),
      });
    }, 800);
  };

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
  const setKey = (s: SheetRow) => `${s.location}::${s.setName}::${s.grouping}`;

  // Keys of sets already scheduled this week
  const scheduledThisWeek = useMemo(
    () => new Set(entries.map((e) => `${e.location}::${e.set_name}::${e.grouping}`)),
    [entries]
  );

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
      return filteredSets.filter((s) => selected.has(setKey(s)));
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

    // Find the next available position in this day/shift slot
    const existing = entries.filter((e) => e.day_of_week === dayIndex && (e.shift === shift || shift === 'Both' || e.shift === 'Both'));
    const maxPos = existing.reduce((max, e) => Math.max(max, e.position ?? -1), -1);

    const toInsert = setsToSchedule.map((s, i) => ({
      week_start: weekStart,
      set_name: s.setName,
      location: s.location,
      grouping: s.grouping ?? '',
      acres: s.acres,
      gpm: s.gpm,
      day_of_week: dayIndex,
      shift,
      notes: notes.trim(),
      position: maxPos + 1 + i,
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

  const handleDeleteSelected = async () => {
    const ids = [...selectedEntries];
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => fetch(`/api/schedule?id=${id}`, { method: 'DELETE' })));
    setSelectedEntries(new Set());
    loadSchedule();
  };

  // Move one or more entries to a day/shift, appending them in their current order
  const handleMoveEntries = async (ids: string[], dayIndex: number, shift: 'AM' | 'PM') => {
    const idSet = new Set(ids);
    // Preserve the entries' existing sorted order (API returns them ordered)
    const ordered = entries.filter((e) => idSet.has(e.id)).map((e) => e.id);
    if (ordered.length === 0) return;
    // Start after any entries already in the target slot (excluding the ones we're moving)
    const existing = entries.filter(
      (e) => e.day_of_week === dayIndex && (e.shift === shift || e.shift === 'Both') && !idSet.has(e.id)
    );
    const maxPos = existing.reduce((max, e) => Math.max(max, e.position ?? -1), -1);
    await Promise.all(
      ordered.map((id, i) =>
        fetch(`/api/schedule?id=${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day_of_week: dayIndex, shift, position: maxPos + 1 + i }),
        })
      )
    );
    setSelectedEntries(new Set());
    loadSchedule();
  };

  const handleReorder = useCallback(async (orderedIds: string[]) => {
    await fetch('/api/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderedIds.map((id, position) => ({ id, position }))),
    });
    loadSchedule();
  }, [loadSchedule]);

  const handleDropOnShift = (e: React.DragEvent, dayIndex: number, shift: 'AM' | 'PM') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverShift(null);
    setDragOverDay(null);

    // Existing scheduled entries being moved (one or many)
    const groupData = e.dataTransfer.getData('existingEntries');
    if (groupData) {
      try {
        const ids: string[] = JSON.parse(groupData);
        if (ids.length) { handleMoveEntries(ids, dayIndex, shift); return; }
      } catch {}
    }

    // Sidebar set being dropped — open modal with shift pre-filled
    let setsToSchedule: SheetRow[] = [];
    try { setsToSchedule = JSON.parse(e.dataTransfer.getData('sets')); } catch { return; }
    if (setsToSchedule.length === 0) return;
    setModal({ dayIndex, defaultShift: shift });
    dragRef.current = { sets: setsToSchedule, startX: 0, startY: 0, currentX: 0, currentY: 0, active: false };
  };

  const handleCopyWeek = async () => {
    if (!copyLocation) { setCopyMsg('Select a location'); return; }
    if (!copyTargetWeek) { setCopyMsg('Select a target week'); return; }
    setCopyLoading(true);
    setCopyMsg('');
    try {
      const res = await fetch('/api/schedule/copy-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, targetWeek: copyTargetWeek, location: copyLocation }),
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

  const getDayShiftEntries = (dayIndex: number, shift: 'AM' | 'PM') =>
    (dayEntriesMap.get(dayIndex) ?? [])
      .filter((e) => e.shift === shift || e.shift === 'Both')
      .sort((a, b) => {
        const locCmp = a.location.localeCompare(b.location);
        if (locCmp !== 0) return locCmp;
        return (a.position ?? Infinity) - (b.position ?? Infinity);
      });

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ backgroundColor: '#f8faf4' }}>
      <NavBar />

      {/* Page header */}
      <div style={{ backgroundColor: '#27500A' }} className="text-white px-4 py-4">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="md:hidden p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-lg leading-none"
              aria-label="Toggle sets sidebar"
            >
              ☰
            </button>
            <div>
              <h1 className="text-2xl font-bold">Manager Portal</h1>
              <p className="text-green-200 text-sm hidden sm:block">Drag sets from sidebar onto day columns to schedule</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setWeekStart(prevWeek(weekStart))} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">‹</button>
            <span className="font-semibold">{formatWeekRange(weekStart)}</span>
            <button onClick={() => setWeekStart(nextWeek(weekStart))} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">›</button>
            <button onClick={() => setWeekStart(getWeekStart())} disabled={weekStart === getWeekStart()} className="px-3 py-1.5 text-xs rounded-md bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-default">Today</button>
          </div>
          <div className="border border-white/30 rounded-xl px-3 pt-1 pb-2">
            <p className="text-green-200 text-xs font-semibold mb-1.5 uppercase tracking-wide">Copy Schedule</p>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={copyLocation}
                onChange={(e) => setCopyLocation(e.target.value)}
                className="border border-white/30 rounded-lg px-2 py-2 text-sm bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="" className="text-gray-800">Select location…</option>
                {locations.map((l) => <option key={l} value={l} className="text-gray-800">{l}</option>)}
              </select>
              <input
                type="date"
                value={copyTargetWeek}
                onChange={(e) => setCopyTargetWeek(e.target.value ? getWeekStart(new Date(e.target.value + 'T00:00:00')) : '')}
                className="border border-white/30 rounded-lg px-2 py-2 text-sm bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50 [color-scheme:dark]"
                title="Pick any day in the target week"
              />
              <button
                onClick={handleCopyWeek}
                disabled={copyLoading || !copyLocation || !copyTargetWeek}
                className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-default"
              >
                {copyLoading ? 'Copying…' : '📋 Copy to Week'}
              </button>
              {copyMsg && (
                <span className={`text-xs ${copyMsg.startsWith('Error') ? 'text-red-300' : 'text-green-200'}`}>
                  {copyMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content: sidebar + calendar */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside className={`
          flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden w-72
          absolute inset-y-0 left-0 z-30 transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
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
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-green-700 hover:underline min-h-[32px] flex items-center">Select all</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => { clearAll(); setFilterLocation(''); setFilterGroup(''); setSearch(''); }} className="text-gray-500 hover:underline min-h-[32px] flex items-center">Clear all</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => loadSets(true)} disabled={setsLoading} className="text-blue-600 hover:underline disabled:opacity-50 min-h-[32px] flex items-center" title="Re-fetch sets from Google Sheet">
                  {setsLoading ? 'Loading…' : '↻ Refresh'}
                </button>
              </div>
              {selected.size > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-green-700 font-semibold">{selected.size} selected</span>
                  <button onClick={clearAll} className="text-red-500 hover:underline">Clear selected</button>
                </div>
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
                const isScheduled = scheduledThisWeek.has(key);
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => { dragStartedRef.current = true; handleDragStart(e, key); }}
                    onDragEnd={() => { setTimeout(() => { dragStartedRef.current = false; }, 100); }}
                    onClick={() => { if (!dragStartedRef.current) toggleSelect(key); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors select-none ${
                      isSelected
                        ? 'bg-green-50 border border-green-300'
                        : isScheduled
                        ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
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
                        {isScheduled && <span className="flex-shrink-0 text-[10px] text-blue-600 font-semibold">✓</span>}
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

          {/* Mobile-only: schedule selected sets button */}
          {selected.size > 0 && (
            <div className="md:hidden p-3 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => {
                  dragRef.current = { sets: allSets.filter((s) => selected.has(setKey(s))), startX: 0, startY: 0, currentX: 0, currentY: 0, active: false };
                  setModal({});
                }}
                style={{ backgroundColor: '#27500A' }}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold"
              >
                Schedule {selected.size} selected set{selected.size !== 1 ? 's' : ''} →
              </button>
            </div>
          )}
          {/* Location notes — only shown when a location is filtered */}
          {filterLocation && (
            <div className="flex-shrink-0 p-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">{filterLocation} Notes</span>
                {notesSaving && <span className="text-[10px] text-gray-400">Saving…</span>}
              </div>
              <textarea
                value={locationNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder={`Notes for ${filterLocation}…`}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          )}
        </aside>

        {/* CALENDAR */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-[900px] flex gap-1 p-2 items-start">
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
                    className="text-white text-center py-2 px-1 rounded-t-xl sticky top-0 z-10"
                  >
                    <div className="font-bold text-sm">{DAYS[dayIndex]}</div>
                    <div className="text-green-200 text-xs">{format(dayDate, 'MMM d')}</div>
                  </div>

                  {scheduleLoading ? (
                    <div className="flex-1 flex items-center justify-center text-gray-300 text-xs">…</div>
                  ) : (
                    <div className="flex flex-col p-1 gap-1">
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
                          onReorder={handleReorder}
                          draggingEntryRef={draggingEntryRef}
                          gpmTotal={genolaGPM_AM > 0 ? genolaGPM_AM : null}
                          acresTotal={charliesAcres_AM > 0 ? charliesAcres_AM : null}
                          setsMap={setsMap}
                          showTime={!!filterLocation}
                          timeValue={slotTimes[`${dayIndex}-AM`] ?? ''}
                          onTimeChange={(v) => handleSlotTimeChange(dayIndex, 'AM', v)}
                          selectedEntries={selectedEntries}
                          onToggleSelect={toggleEntry}
                          draggingGroupRef={draggingGroupRef}
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
                          onReorder={handleReorder}
                          draggingEntryRef={draggingEntryRef}
                          gpmTotal={genolaGPM_PM > 0 ? genolaGPM_PM : null}
                          acresTotal={charliesAcres_PM > 0 ? charliesAcres_PM : null}
                          setsMap={setsMap}
                          showTime={!!filterLocation}
                          timeValue={slotTimes[`${dayIndex}-PM`] ?? ''}
                          onTimeChange={(v) => handleSlotTimeChange(dayIndex, 'PM', v)}
                          selectedEntries={selectedEntries}
                          onToggleSelect={toggleEntry}
                          draggingGroupRef={draggingGroupRef}
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

      {/* Multi-select action pill */}
      {selectedEntries.size > 1 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-green-800 text-white rounded-full shadow-lg px-4 py-2 text-sm">
          <span className="font-semibold">{selectedEntries.size} selected</span>
          <span className="text-green-300 text-xs">drag any to move all</span>
          <button onClick={handleDeleteSelected} className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs font-semibold transition-colors">Delete</button>
          <button onClick={() => setSelectedEntries(new Set())} className="text-white/80 hover:text-white underline text-xs">Clear</button>
        </div>
      )}
    </div>
  );
}

function ShiftSection({
  label,
  entries,
  onDelete,
  onReorder,
  draggingEntryRef,
  gpmTotal,
  acresTotal,
  setsMap,
  showTime,
  timeValue,
  onTimeChange,
  selectedEntries,
  onToggleSelect,
  draggingGroupRef,
}: {
  label: 'AM' | 'PM';
  entries: ScheduleEntry[];
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  draggingEntryRef: { current: ScheduleEntry | null };
  gpmTotal: number | null;
  acresTotal: number | null;
  setsMap: Map<string, SheetRow>;
  showTime: boolean;
  timeValue: string;
  onTimeChange: (value: string) => void;
  selectedEntries: Set<string>;
  onToggleSelect: (id: string) => void;
  draggingGroupRef: { current: string[] | null };
}) {
  const [insertBeforeId, setInsertBeforeId] = useState<string | 'end' | null>(null);

  const labelStyle =
    label === 'AM'
      ? 'bg-sky-100 text-sky-700 border-sky-200'
      : 'bg-orange-100 text-orange-700 border-orange-200';

  if (entries.length === 0) return null;

  const isDraggingInThisSection = () =>
    draggingEntryRef.current !== null &&
    entries.some((e) => e.id === draggingEntryRef.current!.id);

  const getNewOrder = (targetId: string | 'end') => {
    const dragged = draggingEntryRef.current!;
    const ids = entries.map((e) => e.id);
    if (targetId === dragged.id) return ids;
    const without = ids.filter((id) => id !== dragged.id);
    if (targetId === 'end') return [...without, dragged.id];
    const idx = without.indexOf(targetId);
    if (idx === -1) return ids;
    return [...without.slice(0, idx), dragged.id, ...without.slice(idx)];
  };

  return (
    <div
      className="rounded-lg border border-gray-100 overflow-hidden"
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setInsertBeforeId(null);
      }}
    >
      <div className={`flex items-center justify-between gap-1 text-xs font-bold px-2 py-0.5 border-b ${labelStyle}`}>
        <span>{label}</span>
        {showTime && (
          <input
            type="text"
            value={timeValue}
            onChange={(e) => onTimeChange(e.target.value)}
            placeholder="start"
            draggable
            onDragStart={(e) => e.preventDefault()}
            className="w-28 text-right bg-white/50 rounded px-1 py-0 text-xs font-semibold placeholder:font-normal placeholder:text-current/40 focus:outline-none focus:ring-1 focus:ring-current/40"
          />
        )}
      </div>
      <div className="p-1 space-y-px">
        {entries.map((e) => {
          const colors = getLocationColor(e.location);
          const setInfo = setsMap.get(`${e.location}::${e.set_name}`);
          const block = setInfo?.block ?? '';
          const blockDesc = setInfo?.blockDescription ?? '';
          const fullTitle = [e.set_name, block, blockDesc, e.notes].filter(Boolean).join(' · ');
          const isVenueEvent = e.set_name.toLowerCase().includes('venue event');
          return (
            <div key={e.id} className="relative">
              {insertBeforeId === e.id && (
                <div className="absolute -top-px inset-x-0 h-0.5 bg-blue-400 rounded z-10 pointer-events-none" />
              )}
              <div
                draggable
                onClick={(ev) => { ev.stopPropagation(); onToggleSelect(e.id); }}
                onDragStart={(ev) => {
                  ev.stopPropagation();
                  const isGroup = selectedEntries.has(e.id) && selectedEntries.size > 1;
                  const ids = isGroup ? [...selectedEntries] : [e.id];
                  ev.dataTransfer.setData('existingEntries', JSON.stringify(ids));
                  ev.dataTransfer.effectAllowed = 'move';
                  draggingEntryRef.current = e;
                  draggingGroupRef.current = isGroup ? ids : null;
                }}
                onDragEnd={() => {
                  draggingEntryRef.current = null;
                  draggingGroupRef.current = null;
                  setInsertBeforeId(null);
                }}
                onDragOver={(ev) => {
                  // Group drags bubble to the shift drop zone (move, not reorder)
                  if (draggingGroupRef.current) return;
                  if (!isDraggingInThisSection()) return;
                  ev.preventDefault();
                  ev.stopPropagation();
                  const newId = e.id === draggingEntryRef.current?.id ? null : e.id;
                  if (insertBeforeId !== newId) setInsertBeforeId(newId);
                }}
                onDrop={(ev) => {
                  if (draggingGroupRef.current) return;
                  if (!isDraggingInThisSection()) return;
                  ev.preventDefault();
                  ev.stopPropagation();
                  setInsertBeforeId(null);
                  onReorder(getNewOrder(e.id));
                }}
                className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 group overflow-hidden cursor-grab active:cursor-grabbing ${
                  selectedEntries.has(e.id) ? 'ring-2 ring-green-500 ' : ''
                }${isVenueEvent ? 'border border-yellow-400/50' : selectedEntries.has(e.id) ? 'bg-green-50' : 'bg-gray-50'}`}
                style={isVenueEvent ? { background: 'radial-gradient(circle at 15% 50%, rgba(255,215,0,0.4) 0%, transparent 45%), radial-gradient(circle at 80% 20%, rgba(255,80,180,0.35) 0%, transparent 40%), radial-gradient(circle at 55% 85%, rgba(100,180,255,0.3) 0%, transparent 35%), #0d0a1e' } : undefined}
                title={fullTitle}
              >
                {isVenueEvent && <span className="flex-shrink-0 text-xs">🎆</span>}
                {/* Left group: truncates at blockDesc level, set name always visible */}
                <div className="flex items-center gap-1 min-w-0 flex-1">
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
                    <span className={`text-[10px] truncate ${isVenueEvent ? 'text-yellow-300/70' : 'text-gray-400'}`}>{blockDesc}</span>
                  )}
                </div>
                {/* Right group: always visible */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {e.notes?.trim() && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title={e.notes} />
                  )}
                  <button
                    onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
                    className={`text-sm leading-none md:opacity-0 md:group-hover:opacity-100 transition-colors ${isVenueEvent ? 'text-yellow-300/50 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {/* End drop zone — lets user drag to the bottom of the list */}
        <div
          className="relative h-2"
          onDragOver={(ev) => {
            if (!isDraggingInThisSection()) return;
            ev.preventDefault();
            ev.stopPropagation();
            if (insertBeforeId !== 'end') setInsertBeforeId('end');
          }}
          onDrop={(ev) => {
            if (!isDraggingInThisSection()) return;
            ev.preventDefault();
            ev.stopPropagation();
            setInsertBeforeId(null);
            onReorder(getNewOrder('end'));
          }}
        >
          {insertBeforeId === 'end' && (
            <div className="absolute top-0.5 inset-x-0 h-0.5 bg-blue-400 rounded pointer-events-none" />
          )}
        </div>
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
