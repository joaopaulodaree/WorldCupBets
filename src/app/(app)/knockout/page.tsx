import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { KnockoutClient, type BracketState, type KnockoutMatchWithTeams } from '@/components/knockout/KnockoutClient';

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

type ExistingScorePicks = Record<string, { homeGoals: number | null; awayGoals: number | null }>;

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
      existingScorePicks: {} as ExistingScorePicks,
    };
  }

  // Check lock: has first R32 match started?
  const { data: firstR32 } = await admin
    .from('knockout_matches')
    .select('kickoff_at')
    .eq('round', 5)
    .not('kickoff_at', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(1);

  const firstKickoff = firstR32?.[0]?.kickoff_at ? new Date(firstR32[0].kickoff_at) : null;
  const bracketLocked = firstKickoff ? firstKickoff <= new Date() : false;

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

  // Fetch existing score picks for logged-in user
  const existingScorePicks: ExistingScorePicks = {};
  if (userId) {
    const { data: picksData } = await admin
      .from('bracket_picks')
      .select('round, slot, home_goals, away_goals')
      .eq('user_id', userId)
      .eq('is_submitted', true);

    for (const p of picksData ?? []) {
      existingScorePicks[`${p.round}-${p.slot}`] = {
        homeGoals: p.home_goals ?? null,
        awayGoals: p.away_goals ?? null,
      };
    }
  }

  // Determine bracket state
  const hasSubmitted = userId ? Object.keys(existingScorePicks).length > 0 : false;
  const allFinished = matches.length > 0 && matches.every(m => m.status === 'finished');

  let bracketState: BracketState;
  if (!bracketLocked) {
    bracketState = 'available_for_picks';
  } else if (allFinished) {
    bracketState = 'completed';
  } else {
    bracketState = hasSubmitted ? 'results_revealing' : 'picks_locked';
  }

  return { bracketState, matches, existingScorePicks };
}

export default async function KnockoutPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  let bracketState: BracketState = 'locked_pending_groups';
  let matches: KnockoutMatchWithTeams[] = [];
  let existingScorePicks: ExistingScorePicks = {};
  let error: string | null = null;

  try {
    ({ bracketState, matches, existingScorePicks } = await getBracketData(user?.id ?? null));
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
          existingScorePicks={existingScorePicks}
          bracketState={bracketState}
          userId={user?.id ?? ''}
        />
      )}
    </div>
  );
}
