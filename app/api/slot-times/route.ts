import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/slot-times?location=X&weekStart=YYYY-MM-DD
// Returns [{ day_of_week, shift, start_time }]
export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get('location');
  const weekStart = req.nextUrl.searchParams.get('weekStart');
  if (!location || !weekStart) return NextResponse.json({ times: [] });

  const { data, error } = await supabase
    .from('slot_times')
    .select('day_of_week, shift, start_time')
    .eq('location', location)
    .eq('week_start', weekStart);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ times: data ?? [] });
}

// PUT /api/slot-times  { location, weekStart, dayOfWeek, shift, startTime }
export async function PUT(req: NextRequest) {
  const { location, weekStart, dayOfWeek, shift, startTime } = await req.json();
  if (!location || !weekStart || dayOfWeek == null || !shift) {
    return NextResponse.json({ error: 'location, weekStart, dayOfWeek, shift required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('slot_times')
    .upsert(
      { location, week_start: weekStart, day_of_week: dayOfWeek, shift, start_time: startTime ?? '' },
      { onConflict: 'location,week_start,day_of_week,shift' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
