import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { match_id, home_goals, away_goals } = body as Record<string, unknown>;

  if (
    typeof match_id !== 'string' ||
    typeof home_goals !== 'number' ||
    typeof away_goals !== 'number' ||
    !Number.isInteger(home_goals) || !Number.isInteger(away_goals) ||
    home_goals < 0 || home_goals > 99 ||
    away_goals < 0 || away_goals > 99
  ) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Use anon client for reading public match data
  const supabase = await createClient();
  const { data: match } = await supabase
    .from('matches')
    .select('kickoff_at')
    .eq('id', match_id)
    .single();

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (new Date() >= new Date(match.kickoff_at)) {
    return NextResponse.json({ error: 'Match already started' }, { status: 403 });
  }

  // Use admin client to write (no RLS on our custom users)
  const admin = createAdminClient();
  const { error } = await admin
    .from('predictions')
    .upsert(
      { user_id: user.id, match_id, home_goals, away_goals },
      { onConflict: 'user_id,match_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
