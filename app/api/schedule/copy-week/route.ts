import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { nextWeek } from '@/lib/dates';

// POST /api/schedule/copy-week  { weekStart: "YYYY-MM-DD" }
export async function POST(request: Request) {
  const { weekStart } = await request.json();

  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart is required' }, { status: 400 });
  }

  // Fetch current week's entries
  const { data: current, error: fetchError } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('week_start', weekStart);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!current || current.length === 0) {
    return NextResponse.json({ message: 'No entries to copy', count: 0 });
  }

  const targetWeek = nextWeek(weekStart);

  // Delete any existing entries for next week to avoid duplicates
  await supabase.from('schedule_entries').delete().eq('week_start', targetWeek);

  // Clone entries with new week_start, removing id and created_at
  const newEntries = current.map(({ id, created_at, ...rest }) => ({
    ...rest,
    week_start: targetWeek,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('schedule_entries')
    .insert(newEntries)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Copied successfully', count: inserted?.length ?? 0, targetWeek });
}
