import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get('location');
  if (!location) return NextResponse.json({ notes: '' });

  const { data, error } = await supabase
    .from('location_notes')
    .select('notes')
    .eq('location', location)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data?.notes ?? '' });
}

export async function PUT(req: NextRequest) {
  const { location, notes } = await req.json();
  if (!location) return NextResponse.json({ error: 'location required' }, { status: 400 });

  const { error } = await supabase
    .from('location_notes')
    .upsert({ location, notes }, { onConflict: 'location' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
