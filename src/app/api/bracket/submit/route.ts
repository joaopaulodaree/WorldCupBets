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

  // 2. Parse body
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

  // 3. Validate: no draws, valid goal values
  for (const pick of picks) {
    if (typeof pick.homeGoals !== 'number' || typeof pick.awayGoals !== 'number') {
      return NextResponse.json(
        { error: `Pick inválido: gols ausentes (rodada ${pick.round}, slot ${pick.slot})` },
        { status: 400 },
      );
    }
    if (pick.homeGoals === pick.awayGoals) {
      return NextResponse.json(
        { error: `Empate não permitido no mata-mata (rodada ${pick.round}, slot ${pick.slot})` },
        { status: 400 },
      );
    }
  }

  // 4. Reject picks for matches that have already started or finished
  const { data: startedMatches } = await admin
    .from('knockout_matches')
    .select('round, slot')
    .in('status', ['live', 'finished']);

  const startedSet = new Set((startedMatches ?? []).map((m) => `${m.round}-${m.slot}`));

  for (const pick of picks) {
    if (startedSet.has(`${pick.round}-${pick.slot}`)) {
      return NextResponse.json(
        { error: `Jogo já começou — palpite não permitido (rodada ${pick.round}, slot ${pick.slot})` },
        { status: 409 },
      );
    }
  }

  // 5. Upsert picks — allows re-saving until a match starts
  const submittedAt = new Date().toISOString();
  const rows = picks.map((p) => ({
    user_id: user.id,
    round: p.round,
    slot: p.slot,
    team_id: p.teamId,
    home_goals: p.homeGoals,
    away_goals: p.awayGoals,
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
