# Tasks: Auth

## T-AUTH-01 — Setup inicial do projeto Next.js
**O quê:** Criar projeto Next.js 14 com TypeScript, Tailwind CSS, configurar Supabase client
**Onde:** Raiz do projeto
**Depende de:** —
**Done when:** `npm run dev` sobe sem erros, Supabase client conecta ao projeto
**Gate:** `npm run build` sem erros de tipo

## T-AUTH-02 — Schema do banco: profiles + RLS
**O quê:** Criar tabela `profiles` no Supabase, configurar trigger para criar perfil no signup, RLS policies
**Onde:** Supabase SQL editor / migrations
**Depende de:** T-AUTH-01
**Done when:** Trigger cria perfil automaticamente ao criar usuário; RLS bloqueia acesso cross-user
**Gate:** Teste manual: criar usuário, verificar perfil criado

## T-AUTH-03 — Middleware de proteção de rotas
**O quê:** `middleware.ts` redireciona usuários não autenticados para `/login`
**Onde:** `src/middleware.ts`, `src/lib/supabase/middleware.ts`
**Depende de:** T-AUTH-01
**Refs:** AUTH-010, AUTH-011
**Done when:** Acessar `/` sem sessão redireciona para `/login`
**Gate:** Teste manual com e sem cookie de sessão

## T-AUTH-04 — Página de cadastro
**O quê:** Form com nome, email, senha. Chama Supabase signUp. Redireciona para app após sucesso
**Onde:** `src/app/(auth)/register/page.tsx`
**Depende de:** T-AUTH-01, T-AUTH-02
**Refs:** AUTH-001, AUTH-002, AUTH-003, AUTH-004
**Done when:** Usuário preenche form, clica cadastrar, vai para `/matches`
**Gate:** Teste: email duplicado exibe erro; senha curta exibe erro

## T-AUTH-05 — Página de login
**O quê:** Form com email e senha. Chama Supabase signInWithPassword. Redireciona para app
**Onde:** `src/app/(auth)/login/page.tsx`
**Depende de:** T-AUTH-01
**Refs:** AUTH-005, AUTH-006, AUTH-007
**Done when:** Login válido entra no app; credenciais inválidas exibem erro genérico
**Gate:** Fechar browser e voltar: sessão persiste

## T-AUTH-06 — Botão de logout
**O quê:** Ação de server que chama Supabase signOut e redireciona para `/login`
**Onde:** `src/components/layout/Header.tsx`
**Depende de:** T-AUTH-03
**Refs:** AUTH-008, AUTH-009
**Done when:** Clicar logout → `/login`
**Gate:** Após logout, tentar acessar rota protegida → redirect para login
