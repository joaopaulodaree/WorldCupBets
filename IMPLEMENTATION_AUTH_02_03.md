# T-AUTH-02 e T-AUTH-03 — Implementação Completada

## T-AUTH-02: Schema do Banco (Supabase)

### Arquivo criado
- **Arquivo**: `supabase/migrations/20260612000000_create_profiles_table.sql`

### O que foi implementado

1. **Tabela `profiles`**
   - `id`: UUID primária, gerada automaticamente
   - `user_id`: UUID, foreign key para `auth.users`, com restrição UNIQUE
   - `display_name`: texto obrigatório
   - `created_at`: timestamp com time zone, padrão now()

2. **Trigger automático**
   - Função: `handle_new_user()`
   - Quando um usuário é criado em `auth.users`, uma linha é automaticamente inserida em `profiles`
   - O `display_name` vem do metadata `display_name` ou usa o email como fallback

3. **RLS (Row Level Security) Policies**
   - **SELECT**: Usuários só veem seu próprio perfil (`auth.uid() = user_id`)
   - **INSERT**: Usuários só podem inserir seu próprio perfil (usado pelo trigger)
   - **UPDATE**: Usuários só podem atualizar seu próprio perfil
   - **DELETE**: Usuários só podem deletar seu próprio perfil

### Como aplicar a migração

Execute a migração no Supabase SQL Editor ou via CLI:

```bash
# Via Supabase CLI
supabase migration up

# Ou copie e cole o conteúdo do arquivo no SQL Editor do Supabase
```

---

## T-AUTH-03: Middleware de Proteção de Rotas

### Arquivo criado
- **Arquivo**: `middleware.ts` (raiz do projeto)

### O que foi implementado

1. **Proteção de rotas server-side**
   - Verifica autenticação em todos os requests
   - Usa Supabase SSR client para validação

2. **Rotas públicas (sem autenticação obrigatória)**
   - `/login`
   - `/register`
   - `/api/auth/*`

3. **Rotas protegidas**
   - Todas as outras rotas

4. **Comportamento**
   - Usuários não autenticados tentando acessar rotas protegidas são redirecionados para `/login?redirectedFrom={pathname}`
   - Usuários autenticados podem acessar livremente

5. **Variáveis de ambiente necessárias**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Arquivo de exemplo de ambiente
- **Arquivo**: `.env.local.example`
- Copie e renomeie para `.env.local` com suas credenciais do Supabase

---

## Próximos passos

1. Configure as variáveis de ambiente em `.env.local`
2. Execute a migração SQL no Supabase
3. Implemente as páginas `/login` e `/register`
4. Implemente a API `/api/auth/register` e `/api/auth/login`
5. Teste o fluxo completo de autenticação

## Arquivos criados/modificados

```
supabase/
  migrations/
    20260612000000_create_profiles_table.sql  (NOVO)

middleware.ts  (NOVO)

.env.local.example  (NOVO)
```
