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
    .order('shift')
    .order('position', { nullsFirst: false })
    .order('created_at');

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

// PATCH /api/schedule?id=UUID  { day_of_week, shift, position? }
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates = await request.json();

  const { data, error } = await supabase
    .from('schedule_entries')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Supabase PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT /api/schedule — bulk update positions [{ id, position }]
export async function PUT(request: Request) {
  const updates: { id: string; position: number }[] = await request.json();

  const results = await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('schedule_entries').update({ position }).eq('id', id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error('Supabase PUT error:', failed.error);
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
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
