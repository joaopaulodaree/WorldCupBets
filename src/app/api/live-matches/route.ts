import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('matches')
    .select('id, home_goals, away_goals, status')
    .eq('status', 'live');

  const matches = data ?? [];
  return NextResponse.json({ matches, hasLive: matches.length > 0 });
}
