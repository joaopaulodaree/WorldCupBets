import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface PickInput {
  round: number;
  slot: number;
  teamId: string;
  homeGoals: number;
  awayGoals: number;
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

  // 3. Parse body
  let body: { picks?: PickInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const picks = body?.picks;
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'Picks inválidos' }, { status: 400 });
  }

  // 4. Validate no draws
  for (const pick of picks) {
    if (pick.homeGoals === pick.awayGoals) {
      return NextResponse.json(
        { error: `Empate não permitido no mata-mata (rodada ${pick.round}, slot ${pick.slot})` },
        { status: 400 }
      );
    }
  }

  // 5. Validate slot coverage against what's actually populated in the DB
  const { data: availableMatches } = await admin
    .from('knockout_matches')
    .select('round, slot')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);

  const expectedByRound = new Map<number, Set<number>>();
  for (const m of availableMatches ?? []) {
    if (!expectedByRound.has(m.round)) expectedByRound.set(m.round, new Set());
    expectedByRound.get(m.round)!.add(m.slot);
  }

  const totalRequired = (availableMatches ?? []).length;
  if (picks.length !== totalRequired) {
    return NextResponse.json(
      { error: `Envie exatamente ${totalRequired} picks` },
      { status: 400 }
    );
  }

  for (const [round, slots] of expectedByRound) {
    const roundPicks = picks.filter(p => p.round === round);
    if (roundPicks.length !== slots.size) {
      return NextResponse.json(
        { error: `Rodada ${round}: esperado ${slots.size} picks, recebido ${roundPicks.length}` },
        { status: 400 }
      );
    }
    for (const slot of slots) {
      if (!roundPicks.some(p => p.slot === slot)) {
        return NextResponse.json(
          { error: `Rodada ${round}: slot ${slot} não preenchido` },
          { status: 400 }
        );
      }
    }
  }

  // 6. Check bracket not locked (first R32 match hasn't started)
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

  // 7. Insert picks with scores
  const submittedAt = new Date().toISOString();
  const rows = picks.map(p => ({
    user_id: user.id,
    round: p.round,
    slot: p.slot,
    team_id: p.teamId,
    home_goals: p.homeGoals,
    away_goals: p.awayGoals,
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

  return NextResponse.json({ ok: true });
}
