import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const EXPECTED_SLOTS: Record<number, number> = {
  5: 16, // R32
  6: 8,  // R16
  7: 4,  // QF
  8: 2,  // SF
  9: 1,  // Final
};

interface PickInput {
  slot: number;
  teamId: string;
}

export async function POST(request: Request) {
  // 1. Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 2. Parse body
  let body: { round?: number; picks?: PickInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const round = body?.round;
  const picks = body?.picks;

  // 3. Validate round
  if (typeof round !== 'number' || !(round in EXPECTED_SLOTS)) {
    return NextResponse.json({ error: 'Rodada inválida' }, { status: 400 });
  }

  const expectedCount = EXPECTED_SLOTS[round];

  // 4. Validate picks count and slot coverage
  if (!Array.isArray(picks) || picks.length !== expectedCount) {
    return NextResponse.json(
      { error: `Rodada ${round}: envie exatamente ${expectedCount} picks` },
      { status: 400 }
    );
  }

  const slots = new Set(picks.map(p => p.slot));
  for (let s = 0; s < expectedCount; s++) {
    if (!slots.has(s)) {
      return NextResponse.json(
        { error: `Rodada ${round}: slot ${s} não preenchido` },
        { status: 400 }
      );
    }
  }

  // 5. Check this round hasn't started (first match kickoff)
  const { data: firstMatch } = await admin
    .from('knockout_matches')
    .select('kickoff_at')
    .eq('round', round)
    .not('kickoff_at', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(1);

  if (firstMatch?.[0]?.kickoff_at) {
    const firstKickoff = new Date(firstMatch[0].kickoff_at);
    if (firstKickoff <= new Date()) {
      return NextResponse.json(
        { error: `Rodada ${round} já começou — picks não aceitos` },
        { status: 409 }
      );
    }
  }

  // 6. Check this round's slots are populated with real teams
  const { count: populatedSlots } = await admin
    .from('knockout_matches')
    .select('id', { count: 'exact', head: true })
    .eq('round', round)
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);

  if ((populatedSlots ?? 0) < expectedCount) {
    return NextResponse.json(
      { error: `Chaveamento da rodada ${round} ainda não definido` },
      { status: 409 }
    );
  }

  // 7. Upsert picks for this round (allows re-submission before deadline)
  const submittedAt = new Date().toISOString();
  const rows = picks.map(p => ({
    user_id: user.id,
    round,
    slot: p.slot,
    team_id: p.teamId,
    is_submitted: true,
    submitted_at: submittedAt,
  }));

  const { error: upsertError } = await admin
    .from('bracket_picks')
    .upsert(rows, { onConflict: 'user_id,round,slot' });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
