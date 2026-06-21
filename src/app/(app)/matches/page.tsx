'use server';

import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MatchCardData } from '@/components/match/MatchCard';
import type { PredictionData } from '@/components/match/PredictionForm';
import { MatchesClient } from '@/components/match/MatchesClient';

async function getMatchesWithPredictions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('matches')
    .select(`
      id, group_name, round, kickoff_at, status, home_goals, away_goals,
      home_team:home_team_id(name, code, flag_url),
      away_team:away_team_id(name, code, flag_url)
    `)
    .order('kickoff_at', { ascending: true });

  if (error) throw new Error(error.message);

  const matches = (data ?? []) as unknown as MatchCardData[];
  const predictionMap = new Map<string, PredictionData>();

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  if (user) {
    const admin = createAdminClient();
    const { data: predictions } = await admin
      .from('predictions')
      .select('match_id, home_goals, away_goals, points')
      .eq('user_id', user.id);

    for (const p of predictions ?? []) {
      predictionMap.set(p.match_id, {
        homeGoals: p.home_goals,
        awayGoals: p.away_goals,
        points: p.points,
      });
    }
  }

  return { matches, predictionMap: Object.fromEntries(predictionMap) as Record<string, PredictionData>, isAuthenticated: !!user };
}

function groupByDate(matches: MatchCardData[]): { dateKey: string; matches: MatchCardData[] }[] {
  const map = new Map<string, MatchCardData[]>();
  for (const m of matches) {
    // Use Brazil timezone so late-night games (e.g. 22h BRT = 01h UTC next day) group to the correct local date
    const dateKey = new Date(m.kickoff_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(m);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, matches]) => ({ dateKey, matches }));
}

export default async function MatchesPage() {
  let byDate: { dateKey: string; matches: MatchCardData[] }[] = [];
  let predictionMap: Record<string, PredictionData> = {};
  let isAuthenticated = false;
  let error: string | null = null;

  try {
    const result = await getMatchesWithPredictions();
    byDate = groupByDate(result.matches);
    predictionMap = result.predictionMap;
    isAuthenticated = result.isAuthenticated;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erro ao carregar partidas';
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary">Erro ao carregar partidas: {error}</p>
      </div>
    );
  }

  if (byDate.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-green mb-2">Jogos da Copa 2026</h1>
          <p className="text-secondary">Faça seus palpites para a fase de grupos</p>
        </div>
        <div className="bg-secondary border border-primary rounded-xl p-8 text-center">
          <p className="text-secondary">Nenhuma partida encontrada.</p>
        </div>
      </div>
    );
  }

  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  return (
    <MatchesClient
      byDate={byDate}
      predictionMap={predictionMap}
      isAuthenticated={isAuthenticated}
      todayKey={todayKey}
    />
  );
}
