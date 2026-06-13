# Feature: Auth — Autenticação de Usuários

## Objetivo
Permitir que qualquer pessoa crie uma conta e faça login no app com email e senha.

## Requisitos

### Cadastro
- **AUTH-001** O usuário pode se cadastrar com nome de exibição, email e senha
- **AUTH-002** Email deve ser único no sistema; duplicatas retornam erro claro
- **AUTH-003** Senha deve ter no mínimo 6 caracteres
- **AUTH-004** Após cadastro bem-sucedido, o usuário é autenticado automaticamente e redirecionado para o app

### Login
- **AUTH-005** O usuário pode fazer login com email e senha
- **AUTH-006** Credenciais inválidas retornam mensagem de erro genérica (não indica qual campo está errado)
- **AUTH-007** Sessão persiste entre visitas (token armazenado em cookie httpOnly via Supabase)

### Logout
- **AUTH-008** O usuário pode fazer logout a qualquer momento
- **AUTH-009** Após logout, o usuário é redirecionado para a tela de login

### Proteção de rotas
- **AUTH-010** Todas as páginas do app (exceto login e cadastro) requerem autenticação
- **AUTH-011** Usuário não autenticado tentando acessar rota protegida é redirecionado para login

## Notas de implementação
- Usar Supabase Auth com email/password provider
- Middleware Next.js para proteção de rotas server-side
- Formulários com validação client-side antes de chamar Supabase

## Critério de aceite
Usuário consegue se cadastrar, fechar o browser, voltar e ainda estar logado. Outro usuário tenta acessar `/` sem login e é redirecionado para `/login`.
