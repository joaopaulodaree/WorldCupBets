import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFinishedAndLiveGames, getAllKnockoutGames } from '@/lib/worldcup26/client';

// Uses service role to bypass RLS on writes
function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Protect cron endpoint in production
  const authHeader = request.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();

    // Sync all non-finished matches that have been mapped to worldcup26.
    // worldcup26 returns all 104 games in one request, so there's no cost
    // to checking every unfinished match each run.
    const { data: relevantMatches } = await supabase
      .from('matches')
      .select('id, external_id, status')
      .neq('status', 'finished')
      .not('external_id', 'is', null);

    let synced = 0;

    if (relevantMatches?.length) {
      // Fetch live/recent results from worldcup26.ir
      const results = await getFinishedAndLiveGames();
      const resultMap = new Map(results.map((r) => [r.externalId, r]));

      function calcPoints(predHome: number, predAway: number, realHome: number, realAway: number): number {
        if (predHome === realHome && predAway === realAway) return 3;
        return Math.sign(predHome - predAway) === Math.sign(realHome - realAway) ? 1 : 0;
      }

      for (const match of relevantMatches) {
        const result = resultMap.get(match.external_id);
        if (!result) continue;
        if (result.status === match.status && result.status === 'scheduled') continue;

        await supabase
          .from('matches')
          .update({
            status: result.status,
            home_goals: result.homeGoals,
            away_goals: result.awayGoals,
          })
          .eq('id', match.id);

        // Calculate prediction points for newly finished matches
        if (result.status === 'finished' && result.homeGoals !== null && result.awayGoals !== null) {
          const { data: preds } = await supabase
            .from('predictions')
            .select('id, home_goals, away_goals')
            .eq('match_id', match.id)
            .is('points', null);

          for (const p of preds ?? []) {
            const pts = calcPoints(p.home_goals, p.away_goals, result.homeGoals!, result.awayGoals!);
            await supabase.from('predictions').update({ points: pts }).eq('id', p.id);
          }

          // Snapshot the full leaderboard after this match's points are settled
          const { data: allScored } = await supabase
            .from('predictions')
            .select('user_id, points')
            .not('points', 'is', null);

          const totals = new Map<string, number>();
          for (const p of allScored ?? []) {
            totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
          }

          const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
          const snapshots = ranked.map(([userId, pts], i) => ({
            match_id: match.id,
            user_id: userId,
            position: i + 1,
            points: pts,
          }));

          if (snapshots.length > 0) {
            await supabase
              .from('leaderboard_snapshots')
              .upsert(snapshots, { onConflict: 'match_id,user_id' });
          }
        }

        synced++;
      }

      // Backfill: score any predictions that are still null-points for already-finished matches.
      // This handles cases where the sync cycle that marked a match finished failed to score predictions.
      const { data: unscoredPreds } = await supabase
        .from('predictions')
        .select('id, match_id, home_goals, away_goals')
        .is('points', null);

      if (unscoredPreds?.length) {
        const finishedMatchIds = [...new Set(unscoredPreds.map((p) => p.match_id))];
        const { data: finishedMatches } = await supabase
          .from('matches')
          .select('id, status, home_goals, away_goals')
          .in('id', finishedMatchIds)
          .eq('status', 'finished')
          .not('home_goals', 'is', null)
          .not('away_goals', 'is', null);

        if (finishedMatches?.length) {
          const matchResultMap = new Map(finishedMatches.map((m) => [m.id, m]));
          for (const p of unscoredPreds) {
            const match = matchResultMap.get(p.match_id);
            if (!match) continue;
            const pts = calcPoints(p.home_goals, p.away_goals, match.home_goals!, match.away_goals!);
            await supabase.from('predictions').update({ points: pts }).eq('id', p.id);
          }
        }
      }
    }

    // ── Knockout matches sync ────────────────────────────────────────────────
    // Upsert knockout_matches from worldcup26 API.
    // Always runs — needed even after all group-stage matches are finished.
    // Team name → UUID lookup uses the teams table (name field in English).
    await syncKnockoutMatches(supabase);

    return NextResponse.json({ synced });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Knockout sync helpers ──────────────────────────────────────────────────

const ROUND_MAP: Record<string, { round: number; base: number }> = {
  r32: { round: 5, base: 73 },
  r16: { round: 6, base: 89 },
  qf:  { round: 7, base: 97 },
  sf:  { round: 8, base: 101 },
  final: { round: 9, base: 104 },
};

function parseKickoffAt(localDate: string | null): string | null {
  if (!localDate) return null;
  // Format: "MM/DD/YYYY HH:MM" — treat as EDT (UTC-4, used for most Copa 2026 venues)
  const [datePart, timePart] = localDate.split(' ');
  if (!datePart || !timePart) return null;
  const [month, day, year] = datePart.split('/');
  const isoString = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${timePart}:00-04:00`;
  return new Date(isoString).toISOString();
}

async function syncKnockoutMatches(supabase: ReturnType<typeof getAdminClient>) {
  const knockoutGames = await getAllKnockoutGames();
  if (!knockoutGames.length) return;

  // Build team name → UUID map
  const { data: allTeams } = await supabase.from('teams').select('id, name');
  const teamByName = new Map<string, string>(
    (allTeams ?? []).map((t: { id: string; name: string }) => [t.name.toLowerCase(), t.id])
  );

  const rows = knockoutGames.map((game) => {
    const mapping = ROUND_MAP[game.type];
    if (!mapping) return null;

    const slot = game.externalId - mapping.base;
    const homeTeamId = game.homeTeamNameEn
      ? (teamByName.get(game.homeTeamNameEn.toLowerCase()) ?? null)
      : null;
    const awayTeamId = game.awayTeamNameEn
      ? (teamByName.get(game.awayTeamNameEn.toLowerCase()) ?? null)
      : null;

    // Determine winner for finished games (only when goals differ — ties go to ET/penalties)
    let winnerTeamId: string | null = null;
    if (game.status === 'finished' && game.homeGoals !== null && game.awayGoals !== null) {
      if (game.homeGoals > game.awayGoals) winnerTeamId = homeTeamId;
      else if (game.awayGoals > game.homeGoals) winnerTeamId = awayTeamId;
      // Equal goals at FT = ongoing ET/penalties — winnerTeamId stays null until API shows final result
    }

    return {
      external_id: game.externalId,
      round: mapping.round,
      slot,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      winner_team_id: winnerTeamId,
      kickoff_at: parseKickoffAt(game.localDate),
      status: game.status === 'scheduled' && (!homeTeamId || !awayTeamId) ? 'tbd' : game.status,
    };
  });

  const validRows = rows.filter((r) => r !== null);
  if (validRows.length > 0) {
    await supabase
      .from('knockout_matches')
      .upsert(validRows, { onConflict: 'external_id', ignoreDuplicates: false });
  }
}
