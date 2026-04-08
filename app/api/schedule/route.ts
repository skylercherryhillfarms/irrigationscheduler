import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/schedule?weekStart=YYYY-MM-DD
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('weekStart');

  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('week_start', weekStart)
    .order('day_of_week')
    .order('shift');

  if (error) {
    console.error('Supabase GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/schedule — create one or more entries
export async function POST(request: Request) {
  const body = await request.json();

  // Accept either a single entry or an array
  const entries = Array.isArray(body) ? body : [body];

  const { data, error } = await supabase
    .from('schedule_entries')
    .insert(entries)
    .select();

  if (error) {
    console.error('Supabase POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/schedule?id=UUID
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('schedule_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
