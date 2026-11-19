import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Called by a Vercel cron every ~6 days (see vercel.json) so the free-tier
// Supabase project never reaches its 7-day inactivity pause.
export async function GET(request: Request) {
  // If CRON_SECRET is set in Vercel, only accept calls from the cron job
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // One tiny read is enough to count as database activity
  const { error } = await supabase.from('schedule_entries').select('id').limit(1);

  if (error) {
    console.error('Keep-alive check-in failed:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checkedInAt: new Date().toISOString() });
}
