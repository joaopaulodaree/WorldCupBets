import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const VALID_ROUNDS = new Set([5, 6, 7, 8, 9]);

interface PickInput {
  slot: number;
  teamId: string;
}

interface RoundMatch {
  slot: number;
  kickoff_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

export async function POST(request: Request) {
  // 1. Auth
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (typeof round !== 'number' || !VALID_ROUNDS.has(round)) {
    return NextResponse.json({ error: 'Rodada inválida' }, { status: 400 });
  }

  // 4. Validate picks array
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'Nenhum pick enviado' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 5. Fetch all match info for the round (kickoff + teams)
  const { data: roundMatchesRaw } = await admin
    .from('knockout_matches')
    .select('slot, kickoff_at, home_team_id, away_team_id')
    .eq('round', round);

  const matchBySlot = new Map<number, RoundMatch>(
    ((roundMatchesRaw ?? []) as RoundMatch[]).map(m => [m.slot, m])
  );

  const now = new Date();

  // 6. Keep only valid picks: unlocked match, both teams set, teamId is one of them
  const validPicks: PickInput[] = [];
  for (const p of picks) {
    if (typeof p.slot !== 'number' || !p.teamId) continue;
    const match = matchBySlot.get(p.slot);
    if (!match) continue;
    if (!match.home_team_id || !match.away_team_id) continue;
    if (p.teamId !== match.home_team_id && p.teamId !== match.away_team_id) continue;
    if (match.kickoff_at && new Date(match.kickoff_at) <= now) continue;
    validPicks.push(p);
  }

  if (validPicks.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum pick válido — jogos já começaram ou equipes não definidas' },
      { status: 409 }
    );
  }

  // 7. Upsert valid picks (allows re-submission before kickoff)
  const submittedAt = new Date().toISOString();
  const rows = validPicks.map(p => ({
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
