import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── 48 seleções — Copa do Mundo 2026 ────────────────────────────────────────

const TEAMS = [
  // Grupo A
  { code: 'MEX', name: 'México',            flag_url: 'https://flagcdn.com/w80/mx.png' },
  { code: 'RSA', name: 'África do Sul',     flag_url: 'https://flagcdn.com/w80/za.png' },
  { code: 'KOR', name: 'Coreia do Sul',     flag_url: 'https://flagcdn.com/w80/kr.png' },
  { code: 'CZE', name: 'Rep. Tcheca',       flag_url: 'https://flagcdn.com/w80/cz.png' },
  // Grupo B
  { code: 'CAN', name: 'Canadá',            flag_url: 'https://flagcdn.com/w80/ca.png' },
  { code: 'BIH', name: 'Bósnia',            flag_url: 'https://flagcdn.com/w80/ba.png' },
  { code: 'QAT', name: 'Catar',             flag_url: 'https://flagcdn.com/w80/qa.png' },
  { code: 'SUI', name: 'Suíça',             flag_url: 'https://flagcdn.com/w80/ch.png' },
  // Grupo C
  { code: 'BRA', name: 'Brasil',            flag_url: 'https://flagcdn.com/w80/br.png' },
  { code: 'MAR', name: 'Marrocos',          flag_url: 'https://flagcdn.com/w80/ma.png' },
  { code: 'HAI', name: 'Haiti',             flag_url: 'https://flagcdn.com/w80/ht.png' },
  { code: 'SCO', name: 'Escócia',           flag_url: 'https://flagcdn.com/w80/gb-sct.png' },
  // Grupo D
  { code: 'USA', name: 'Estados Unidos',    flag_url: 'https://flagcdn.com/w80/us.png' },
  { code: 'PAR', name: 'Paraguai',          flag_url: 'https://flagcdn.com/w80/py.png' },
  { code: 'AUS', name: 'Austrália',         flag_url: 'https://flagcdn.com/w80/au.png' },
  { code: 'TUR', name: 'Turquia',           flag_url: 'https://flagcdn.com/w80/tr.png' },
  // Grupo E
  { code: 'GER', name: 'Alemanha',          flag_url: 'https://flagcdn.com/w80/de.png' },
  { code: 'CUW', name: 'Curaçao',           flag_url: 'https://flagcdn.com/w80/cw.png' },
  { code: 'CIV', name: 'Costa do Marfim',   flag_url: 'https://flagcdn.com/w80/ci.png' },
  { code: 'ECU', name: 'Equador',           flag_url: 'https://flagcdn.com/w80/ec.png' },
  // Grupo F
  { code: 'NED', name: 'Holanda',           flag_url: 'https://flagcdn.com/w80/nl.png' },
  { code: 'JPN', name: 'Japão',             flag_url: 'https://flagcdn.com/w80/jp.png' },
  { code: 'SWE', name: 'Suécia',            flag_url: 'https://flagcdn.com/w80/se.png' },
  { code: 'TUN', name: 'Tunísia',           flag_url: 'https://flagcdn.com/w80/tn.png' },
  // Grupo G
  { code: 'BEL', name: 'Bélgica',           flag_url: 'https://flagcdn.com/w80/be.png' },
  { code: 'EGY', name: 'Egito',             flag_url: 'https://flagcdn.com/w80/eg.png' },
  { code: 'IRN', name: 'Irã',               flag_url: 'https://flagcdn.com/w80/ir.png' },
  { code: 'NZL', name: 'Nova Zelândia',     flag_url: 'https://flagcdn.com/w80/nz.png' },
  // Grupo H
  { code: 'ESP', name: 'Espanha',           flag_url: 'https://flagcdn.com/w80/es.png' },
  { code: 'CPV', name: 'Cabo Verde',        flag_url: 'https://flagcdn.com/w80/cv.png' },
  { code: 'KSA', name: 'Arábia Saudita',   flag_url: 'https://flagcdn.com/w80/sa.png' },
  { code: 'URU', name: 'Uruguai',           flag_url: 'https://flagcdn.com/w80/uy.png' },
  // Grupo I
  { code: 'FRA', name: 'França',            flag_url: 'https://flagcdn.com/w80/fr.png' },
  { code: 'SEN', name: 'Senegal',           flag_url: 'https://flagcdn.com/w80/sn.png' },
  { code: 'IRQ', name: 'Iraque',            flag_url: 'https://flagcdn.com/w80/iq.png' },
  { code: 'NOR', name: 'Noruega',           flag_url: 'https://flagcdn.com/w80/no.png' },
  // Grupo J
  { code: 'ARG', name: 'Argentina',         flag_url: 'https://flagcdn.com/w80/ar.png' },
  { code: 'ALG', name: 'Argélia',           flag_url: 'https://flagcdn.com/w80/dz.png' },
  { code: 'AUT', name: 'Áustria',           flag_url: 'https://flagcdn.com/w80/at.png' },
  { code: 'JOR', name: 'Jordânia',          flag_url: 'https://flagcdn.com/w80/jo.png' },
  // Grupo K
  { code: 'POR', name: 'Portugal',          flag_url: 'https://flagcdn.com/w80/pt.png' },
  { code: 'COD', name: 'RD Congo',          flag_url: 'https://flagcdn.com/w80/cd.png' },
  { code: 'UZB', name: 'Uzbequistão',       flag_url: 'https://flagcdn.com/w80/uz.png' },
  { code: 'COL', name: 'Colômbia',          flag_url: 'https://flagcdn.com/w80/co.png' },
  // Grupo L
  { code: 'ENG', name: 'Inglaterra',        flag_url: 'https://flagcdn.com/w80/gb-eng.png' },
  { code: 'CRO', name: 'Croácia',           flag_url: 'https://flagcdn.com/w80/hr.png' },
  { code: 'GHA', name: 'Gana',              flag_url: 'https://flagcdn.com/w80/gh.png' },
  { code: 'PAN', name: 'Panamá',            flag_url: 'https://flagcdn.com/w80/pa.png' },
];

// ─── 72 jogos — fase de grupos ────────────────────────────────────────────────
// Formato: [grupo, rodada, mandante, visitante, horário UTC]

type MatchRow = [string, number, string, string, string];

const MATCHES: MatchRow[] = [
  // ── Rodada 1 ─────────────────────────────────────────────────────────────
  ['A', 1, 'MEX', 'RSA', '2026-06-11T20:00:00Z'],
  ['A', 1, 'KOR', 'CZE', '2026-06-12T00:00:00Z'],
  ['B', 1, 'CAN', 'BIH', '2026-06-12T17:00:00Z'],
  ['B', 1, 'QAT', 'SUI', '2026-06-12T20:00:00Z'],
  ['C', 1, 'BRA', 'SCO', '2026-06-13T17:00:00Z'],
  ['C', 1, 'MAR', 'HAI', '2026-06-13T20:00:00Z'],
  ['D', 1, 'USA', 'PAR', '2026-06-14T17:00:00Z'],
  ['D', 1, 'AUS', 'TUR', '2026-06-14T20:00:00Z'],
  ['E', 1, 'GER', 'ECU', '2026-06-15T17:00:00Z'],
  ['E', 1, 'CIV', 'CUW', '2026-06-15T20:00:00Z'],
  ['F', 1, 'NED', 'SWE', '2026-06-16T17:00:00Z'],
  ['F', 1, 'JPN', 'TUN', '2026-06-16T20:00:00Z'],
  ['G', 1, 'BEL', 'IRN', '2026-06-17T17:00:00Z'],
  ['G', 1, 'EGY', 'NZL', '2026-06-17T20:00:00Z'],
  ['H', 1, 'ESP', 'URU', '2026-06-18T17:00:00Z'],
  ['H', 1, 'KSA', 'CPV', '2026-06-18T20:00:00Z'],
  ['I', 1, 'FRA', 'IRQ', '2026-06-19T17:00:00Z'],
  ['I', 1, 'SEN', 'NOR', '2026-06-19T20:00:00Z'],
  ['J', 1, 'ARG', 'AUT', '2026-06-20T17:00:00Z'],
  ['J', 1, 'ALG', 'JOR', '2026-06-20T20:00:00Z'],
  ['K', 1, 'POR', 'UZB', '2026-06-21T17:00:00Z'],
  ['K', 1, 'COL', 'COD', '2026-06-21T20:00:00Z'],
  ['L', 1, 'ENG', 'GHA', '2026-06-22T17:00:00Z'],
  ['L', 1, 'CRO', 'PAN', '2026-06-22T20:00:00Z'],

  // ── Rodada 2 ─────────────────────────────────────────────────────────────
  ['A', 2, 'MEX', 'KOR', '2026-06-15T00:00:00Z'],
  ['A', 2, 'RSA', 'CZE', '2026-06-15T23:00:00Z'],
  ['B', 2, 'CAN', 'QAT', '2026-06-16T00:00:00Z'],
  ['B', 2, 'BIH', 'SUI', '2026-06-16T23:00:00Z'],
  ['C', 2, 'BRA', 'MAR', '2026-06-17T00:00:00Z'],
  ['C', 2, 'SCO', 'HAI', '2026-06-17T23:00:00Z'],
  ['D', 2, 'USA', 'AUS', '2026-06-18T00:00:00Z'],
  ['D', 2, 'PAR', 'TUR', '2026-06-18T23:00:00Z'],
  ['E', 2, 'GER', 'CIV', '2026-06-19T00:00:00Z'],
  ['E', 2, 'ECU', 'CUW', '2026-06-19T23:00:00Z'],
  ['F', 2, 'NED', 'JPN', '2026-06-20T00:00:00Z'],
  ['F', 2, 'SWE', 'TUN', '2026-06-20T23:00:00Z'],
  ['G', 2, 'BEL', 'EGY', '2026-06-21T00:00:00Z'],
  ['G', 2, 'IRN', 'NZL', '2026-06-21T23:00:00Z'],
  ['H', 2, 'ESP', 'KSA', '2026-06-22T00:00:00Z'],
  ['H', 2, 'URU', 'CPV', '2026-06-22T23:00:00Z'],
  ['I', 2, 'FRA', 'SEN', '2026-06-23T00:00:00Z'],
  ['I', 2, 'IRQ', 'NOR', '2026-06-23T23:00:00Z'],
  ['J', 2, 'ARG', 'ALG', '2026-06-24T00:00:00Z'],
  ['J', 2, 'AUT', 'JOR', '2026-06-24T23:00:00Z'],
  ['K', 2, 'POR', 'COL', '2026-06-25T00:00:00Z'],
  ['K', 2, 'UZB', 'COD', '2026-06-25T23:00:00Z'],
  ['L', 2, 'ENG', 'CRO', '2026-06-26T00:00:00Z'],
  ['L', 2, 'GHA', 'PAN', '2026-06-26T23:00:00Z'],

  // ── Rodada 3 (simultâneos por grupo) ─────────────────────────────────────
  ['A', 3, 'MEX', 'CZE', '2026-06-24T20:00:00Z'],
  ['A', 3, 'RSA', 'KOR', '2026-06-24T20:00:00Z'],
  ['B', 3, 'CAN', 'SUI', '2026-06-25T20:00:00Z'],
  ['B', 3, 'BIH', 'QAT', '2026-06-25T20:00:00Z'],
  ['C', 3, 'BRA', 'HAI', '2026-06-26T17:00:00Z'],
  ['C', 3, 'MAR', 'SCO', '2026-06-26T17:00:00Z'],
  ['D', 3, 'USA', 'TUR', '2026-06-26T20:00:00Z'],
  ['D', 3, 'PAR', 'AUS', '2026-06-26T20:00:00Z'],
  ['E', 3, 'GER', 'CUW', '2026-06-27T17:00:00Z'],
  ['E', 3, 'CIV', 'ECU', '2026-06-27T17:00:00Z'],
  ['F', 3, 'NED', 'TUN', '2026-06-27T20:00:00Z'],
  ['F', 3, 'JPN', 'SWE', '2026-06-27T20:00:00Z'],
  ['G', 3, 'BEL', 'NZL', '2026-06-25T17:00:00Z'],
  ['G', 3, 'EGY', 'IRN', '2026-06-25T17:00:00Z'],
  ['H', 3, 'ESP', 'CPV', '2026-06-28T17:00:00Z'],
  ['H', 3, 'URU', 'KSA', '2026-06-28T17:00:00Z'],
  ['I', 3, 'FRA', 'NOR', '2026-06-28T17:00:00Z'],
  ['I', 3, 'SEN', 'IRQ', '2026-06-28T17:00:00Z'],
  ['J', 3, 'ARG', 'JOR', '2026-06-28T20:00:00Z'],
  ['J', 3, 'ALG', 'AUT', '2026-06-28T20:00:00Z'],
  ['K', 3, 'POR', 'COD', '2026-06-29T17:00:00Z'],
  ['K', 3, 'COL', 'UZB', '2026-06-29T17:00:00Z'],
  ['L', 3, 'ENG', 'PAN', '2026-06-29T20:00:00Z'],
  ['L', 3, 'CRO', 'GHA', '2026-06-29T20:00:00Z'],
];

async function seed() {
  console.log('Limpando dados anteriores...');
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Inserindo 48 seleções...');
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .upsert(TEAMS, { onConflict: 'code' })
    .select('id, code');

  if (teamsErr) throw teamsErr;

  const teamMap = Object.fromEntries((teams ?? []).map((t) => [t.code, t.id]));
  console.log(`✓ ${teams?.length} seleções inseridas`);

  console.log('Inserindo 72 partidas...');
  const matchRows = MATCHES.map(([group_name, round, home, away, kickoff_at]) => ({
    group_name,
    round,
    home_team_id: teamMap[home],
    away_team_id: teamMap[away],
    kickoff_at,
    status: 'scheduled',
  }));

  const { error: matchErr } = await supabase.from('matches').insert(matchRows);
  if (matchErr) throw matchErr;

  console.log(`✓ ${matchRows.length} partidas inseridas`);
  console.log('Seed concluído!');
}

seed().catch((err) => {
  console.error('Erro no seed:', err.message);
  process.exit(1);
});
