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

const TOTAL_PICKS = 31;

interface PickInput {
  round: number;
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

  // 2. Check already submitted
  const { data: existing } = await admin
    .from('bracket_picks')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_submitted', true)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ alreadySubmitted: true }, { status: 409 });
  }

  // 3. Parse body and validate picks count
  let body: { picks?: PickInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const picks = body?.picks;
  if (!Array.isArray(picks) || picks.length !== TOTAL_PICKS) {
    return NextResponse.json(
      { error: `Envie exatamente ${TOTAL_PICKS} picks` },
      { status: 400 }
    );
  }

  // 4. Validate slot coverage per round
  for (const [roundStr, expectedCount] of Object.entries(EXPECTED_SLOTS)) {
    const round = parseInt(roundStr, 10);
    const roundPicks = picks.filter(p => p.round === round);
    if (roundPicks.length !== expectedCount) {
      return NextResponse.json(
        { error: `Rodada ${round}: esperado ${expectedCount} picks, recebido ${roundPicks.length}` },
        { status: 400 }
      );
    }
    const slots = new Set(roundPicks.map(p => p.slot));
    for (let s = 0; s < expectedCount; s++) {
      if (!slots.has(s)) {
        return NextResponse.json(
          { error: `Rodada ${round}: slot ${s} não preenchido` },
          { status: 400 }
        );
      }
    }
  }

  // 5. Check bracket not locked (first R32 match hasn't started)
  const { data: firstR32 } = await admin
    .from('knockout_matches')
    .select('kickoff_at')
    .eq('round', 5)
    .not('kickoff_at', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(1);

  if (firstR32?.[0]?.kickoff_at) {
    const firstKickoff = new Date(firstR32[0].kickoff_at);
    if (firstKickoff <= new Date()) {
      return NextResponse.json(
        { error: 'Bracket travado — primeiro jogo já começou' },
        { status: 409 }
      );
    }
  }

  // 6. Check 16 R32 slots populated
  const { count: populatedR32 } = await admin
    .from('knockout_matches')
    .select('id', { count: 'exact', head: true })
    .eq('round', 5)
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);

  if ((populatedR32 ?? 0) < 16) {
    return NextResponse.json(
      { error: 'Chaveamento de Oitavas ainda não definido' },
      { status: 409 }
    );
  }

  // 7. Insert all 31 picks atomically
  const submittedAt = new Date().toISOString();
  const rows = picks.map(p => ({
    user_id: user.id,
    round: p.round,
    slot: p.slot,
    team_id: p.teamId,
    is_submitted: true,
    submitted_at: submittedAt,
  }));

  const { error: insertError } = await admin.from('bracket_picks').insert(rows);

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ alreadySubmitted: true }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 8. Return success
  return NextResponse.json({ ok: true });
}
