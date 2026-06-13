# Feature: Group Tables — Tabelas de Grupos

## Objetivo
Exibir lado a lado a tabela de grupos real (baseada nos resultados oficiais) e a tabela simulada (baseada nos palpites do usuário logado), para todos os 8 grupos da fase de grupos.

## Requisitos

### Tabela Real
- **GT-001** A tabela real exibe a classificação oficial de cada grupo: posição, seleção (bandeira + nome), jogos, vitórias, empates, derrotas, gols pró, gols contra, saldo de gols, pontos
- **GT-002** Seleções classificadas às oitavas (1º e 2º de cada grupo) são destacadas visualmente
- **GT-003** A tabela real é calculada a partir dos resultados oficiais armazenados no banco (não direto da API em tempo real)
- **GT-004** Partidas ainda não jogadas não contam para a tabela real (só resultados confirmados)

### Tabela Simulada
- **GT-005** A tabela simulada exibe a classificação hipotética baseada nos palpites do usuário logado
- **GT-006** Partidas sem palpite do usuário são tratadas como 0x0 (empate, +1 ponto para cada seleção) na simulação
- **GT-007** A tabela simulada usa as mesmas regras de classificação da tabela real (pontos → saldo de gols → gols pró → ordem alfabética)
- **GT-008** Quando uma partida já tem resultado oficial, a tabela simulada usa o resultado real (não mais o palpite)
- **GT-009** A tabela simulada é específica por usuário — cada um vê a sua própria projeção

### Navegação e Layout
- **GT-010** O usuário navega entre os 8 grupos (A a H) via tabs ou seletor
- **GT-011** As duas tabelas (real e simulada) são exibidas lado a lado no desktop e empilhadas no mobile
- **GT-012** Labels claros identificam cada tabela: "Classificação Real" e "Sua Projeção"

### Critérios de classificação (desempate)
- **GT-013** Ordem de desempate: 1. pontos, 2. saldo de gols, 3. gols pró, 4. ordem alfabética do nome da seleção

## Notas de implementação
- Cálculo da tabela simulada é feito no servidor (Server Component ou API route) para não expor lógica de outros usuários
- Função SQL ou lógica TS que recebe lista de partidas com resultados/palpites e retorna classificação ordenada
- Pode ser calculado on-demand (não precisa de cache agressivo, são só 48 partidas)

## Critério de aceite
Usuário que palpitou Brasil vencendo todos os jogos vê Brasil em 1º na tabela simulada do Grupo X. A tabela real mostra o estado atual com resultados oficiais. As duas tabelas são visualmente distintas e claramente rotuladas.
