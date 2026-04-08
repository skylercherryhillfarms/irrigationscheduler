import { NextResponse } from 'next/server';
import { fetchSets } from '@/lib/sheets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === '1';

  const sets = await fetchSets(forceRefresh);
  return NextResponse.json(sets);
}
