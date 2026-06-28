import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { KnockoutClient, type BracketState } from '@/components/knockout/KnockoutClient';
import type { KnockoutMatchWithTeams } from '@/components/knockout/BracketCard';

type RawTeam = { id: string; name: string; code: string; flag_url: string } | null;

interface RawMatch {
  id: string;
  round: number;
  slot: number;
  kickoff_at: string | null;
  status: string;
  winner_team_id: string | null;
  home_team: RawTeam;
  away_team: RawTeam;
}

const ROUND_EXPECTED: Record<number, number> = { 5: 16, 6: 8, 7: 4, 8: 2, 9: 1 };
const ROUNDS = [5, 6, 7, 8, 9] as const;

async function getBracketData(userId: string | null) {
  const admin = createAdminClient();

  // Check if groups are finished and R32 slots populated
  const [{ count: unfinished }, { count: populatedR32 }] = await Promise.all([
    admin.from('matches').select('id', { count: 'exact', head: true }).neq('status', 'finished'),
    admin
      .from('knockout_matches')
      .select('id', { count: 'exact', head: true })
      .eq('round', 5)
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null),
  ]);

  const groupsFinished = (unfinished ?? 1) === 0;
  const r32Ready = (populatedR32 ?? 0) >= 16;

  if (!groupsFinished || !r32Ready) {
    return {
      bracketState: 'locked_pending_groups' as BracketState,
      matches: [] as KnockoutMatchWithTeams[],
      existingPicks: {} as Record<string, string>,
      roundLocked: {} as Record<number, boolean>,
      submittedRounds: {} as Record<number, boolean>,
    };
  }

  // Fetch all knockout matches with team info
  const { data: rawMatches } = await admin
    .from('knockout_matches')
    .select(`
      id, round, slot, kickoff_at, status, winner_team_id,
      home_team:home_team_id(id, name, code, flag_url),
      away_team:away_team_id(id, name, code, flag_url)
    `)
    .order('round', { ascending: true })
    .order('slot', { ascending: true });

  const matches: KnockoutMatchWithTeams[] = ((rawMatches ?? []) as unknown as RawMatch[]).map((m) => ({
    id: m.id,
    round: m.round,
    slot: m.slot,
    kickoffAt: m.kickoff_at,
    status: m.status as KnockoutMatchWithTeams['status'],
    winnerTeamId: m.winner_team_id,
    homeTeam: m.home_team ? { id: m.home_team.id, name: m.home_team.name, code: m.home_team.code, flagUrl: m.home_team.flag_url } : null,
    awayTeam: m.away_team ? { id: m.away_team.id, name: m.away_team.name, code: m.away_team.code, flagUrl: m.away_team.flag_url } : null,
  }));

  // Compute per-round lock: a round is locked once its first match kicks off
  const now = new Date();
  const roundLocked: Record<number, boolean> = {};
  for (const round of ROUNDS) {
    const kickoffs = matches
      .filter(m => m.round === round && m.kickoffAt != null)
      .map(m => new Date(m.kickoffAt!));
    if (kickoffs.length === 0) {
      roundLocked[round] = false;
    } else {
      const firstKickoff = kickoffs.reduce((min, t) => (t < min ? t : min));
      roundLocked[round] = firstKickoff <= now;
    }
  }

  // Fetch existing picks for logged-in user
  const existingPicks: Record<string, string> = {};
  const submittedRounds: Record<number, boolean> = {};

  if (userId) {
    const { data: picksData } = await admin
      .from('bracket_picks')
      .select('round, slot, team_id')
      .eq('user_id', userId)
      .eq('is_submitted', true);

    for (const p of picksData ?? []) {
      existingPicks[`${p.round}-${p.slot}`] = p.team_id;
    }

    // Round is "submitted" when user has all expected picks for it
    for (const round of ROUNDS) {
      const count = (picksData ?? []).filter(p => p.round === round).length;
      submittedRounds[round] = count >= (ROUND_EXPECTED[round] ?? 0);
    }
  }

  // Determine top-level bracket state
  const allFinished = matches.length > 0 && matches.every(m => m.status === 'finished');
  const anyRoundOpen = ROUNDS.some(r => !roundLocked[r]);

  let bracketState: BracketState;
  if (allFinished) {
    bracketState = 'completed';
  } else if (anyRoundOpen) {
    bracketState = 'available_for_picks';
  } else {
    bracketState = 'results_revealing';
  }

  return { bracketState, matches, existingPicks, roundLocked, submittedRounds };
}

export default async function KnockoutPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  let bracketState: BracketState = 'locked_pending_groups';
  let matches: KnockoutMatchWithTeams[] = [];
  let existingPicks: Record<string, string> = {};
  let roundLocked: Record<number, boolean> = {};
  let submittedRounds: Record<number, boolean> = {};
  let error: string | null = null;

  try {
    ({ bracketState, matches, existingPicks, roundLocked, submittedRounds } = await getBracketData(user?.id ?? null));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erro ao carregar mata-mata';
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--brand-green)' }}>Mata-Mata</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Seu bracket da Copa 2026</p>
      </div>

      {error ? (
        <div className="text-center py-12">
          <p style={{ color: 'var(--text-secondary)' }}>Erro: {error}</p>
        </div>
      ) : (
        <KnockoutClient
          matches={matches}
          existingPicks={existingPicks}
          bracketState={bracketState}
          userId={user?.id ?? ''}
          roundLocked={roundLocked}
          submittedRounds={submittedRounds}
        />
      )}
    </div>
  );
}
