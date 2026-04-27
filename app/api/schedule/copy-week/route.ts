import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/schedule/copy-week  { weekStart: "YYYY-MM-DD", targetWeek: "YYYY-MM-DD", location: "Charlies" }
export async function POST(request: Request) {
  const { weekStart, targetWeek, location } = await request.json();

  if (!weekStart) return NextResponse.json({ error: 'weekStart is required' }, { status: 400 });
  if (!targetWeek) return NextResponse.json({ error: 'targetWeek is required' }, { status: 400 });
  if (!location) return NextResponse.json({ error: 'location is required' }, { status: 400 });
  if (targetWeek === weekStart) return NextResponse.json({ error: 'Target week must differ from the current week' }, { status: 400 });

  // Check if target week already has entries for this location
  const { count, error: checkError } = await supabase
    .from('schedule_entries')
    .select('*', { count: 'exact', head: true })
    .eq('week_start', targetWeek)
    .eq('location', location);

  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 500 });
  }
  if (count && count > 0) {
    return NextResponse.json({
      error: `${location} already has ${count} entr${count === 1 ? 'y' : 'ies'} scheduled for ${targetWeek}. Remove them before copying.`,
    }, { status: 409 });
  }

  // Fetch this week's entries for the selected location
  const { data: current, error: fetchError } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('week_start', weekStart)
    .eq('location', location);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!current || current.length === 0) {
    return NextResponse.json({ message: 'No entries to copy', count: 0, targetWeek });
  }

  // Clone entries with new week_start, stripping id and created_at
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
