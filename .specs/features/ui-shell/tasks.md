# Tasks: UI Shell

## T-UI-01 — Tema Tailwind: verde/amarelo dark mode
**O quê:** Configurar `tailwind.config.ts` com cores Brasil, dark mode como padrão, fonte Inter
**Onde:** `tailwind.config.ts`, `src/app/globals.css`
**Depende de:** T-AUTH-01
**Refs:** UI-001, UI-002, UI-003
**Done when:** Classes `bg-brazil-green`, `text-brazil-yellow` disponíveis; fundo do app é escuro
**Gate:** Visual check no browser

## T-UI-02 — Layout shell das rotas protegidas
**O quê:** `(app)/layout.tsx` com Header, BottomNav (mobile) e Sidebar (desktop)
**Onde:** `src/app/(app)/layout.tsx`, `src/components/layout/`
**Depende de:** T-UI-01, T-AUTH-03
**Refs:** UI-006, UI-007, UI-008, UI-009
**Done when:** Todas as rotas protegidas têm navegação consistente; tab ativa destacada
**Gate:** Responsive check em 375px e 1280px

## T-UI-03 — Componentes UI primitivos
**O quê:** Button, Card, Badge, Skeleton, Toast (usando shadcn/ui como base)
**Onde:** `src/components/ui/`
**Depende de:** T-UI-01
**Refs:** UI-017, UI-018, UI-019
**Done when:** Componentes funcionam com as cores do tema Brasil
**Gate:** Visual check de cada componente

## T-UI-04 — Configuração PWA
**O quê:** `next-pwa`, `manifest.json`, ícones, meta tags para iOS, service worker
**Onde:** `public/manifest.json`, `src/app/layout.tsx`
**Depende de:** T-UI-01
**Refs:** UI-010, UI-011, UI-012, UI-013
**Done when:** Chrome DevTools → Application → Manifest sem erros; "Adicionar à tela inicial" funciona
**Gate:** Lighthouse PWA score ≥ 80
