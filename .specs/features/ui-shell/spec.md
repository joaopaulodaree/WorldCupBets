# Feature: UI Shell — Estrutura Visual e PWA

## Objetivo
Estabelecer a identidade visual do app, a estrutura de navegação, e configurar o PWA para que o app seja instalável no celular.

## Requisitos

### Identidade Visual
- **UI-001** Tema dark mode como padrão (fundo escuro ~#0D1117)
- **UI-002** Cores primárias: verde Brasil (#009C3B) e amarelo Brasil (#FFDF00)
- **UI-003** Tipografia: fonte moderna e legível (Inter ou similar via Google Fonts)
- **UI-004** Elementos de score/placar usam tipografia estilo "placar de estádio" (fonte mono ou display)
- **UI-005** Animações sutis com Framer Motion: transições de página, entrada de cards, atualização de leaderboard

### Navegação
- **UI-006** Bottom navigation bar no mobile com 4 tabs: Partidas, Grupos, Leaderboard, Perfil
- **UI-007** Sidebar ou top nav no desktop com os mesmos destinos
- **UI-008** Indicador visual na tab ativa
- **UI-009** Header global exibe logo do app e nome do usuário logado

### PWA
- **UI-010** App configurado como PWA com manifest.json (nome, ícones, cores, display: standalone)
- **UI-011** Service worker para cache de assets estáticos (shell do app funciona offline)
- **UI-012** Ícone do app com temática Copa do Mundo / Brasil para instalação na tela inicial
- **UI-013** Meta tags corretas para iOS (apple-touch-icon, viewport, theme-color)

### Responsividade
- **UI-014** Layout mobile-first, funcional em telas de 375px a 1440px+
- **UI-015** Tabelas de grupos e leaderboard adaptam-se: coluna completa no desktop, versão compacta no mobile
- **UI-016** Cards de partidas são touch-friendly (tap area mínimo 44x44px)

### Estados globais
- **UI-017** Loading states com skeleton screens (não spinners simples)
- **UI-018** Error states com mensagem amigável e botão de retry
- **UI-019** Toast notifications para feedback de ações (palpite salvo, erro de conexão)

## Critério de aceite
App instalado na tela inicial do iPhone exibe ícone correto, abre sem barra do browser, e a navegação bottom bar funciona. No desktop, o layout usa o espaço horizontal com sidebar. Esquema de cores verde/amarelo é consistente em todas as páginas.
