
# Área administrativa com login para o time de TI

## Objetivo

Hoje qualquer pessoa que abre o site pode cadastrar, editar e remover programas do catálogo. Vamos separar em duas áreas:

- **Pública (`/`)** — catálogo somente leitura. Usuários finais continuam podendo clicar em **Instalar / Desinstalar** sem login (o agente local é quem executa).
- **Administrativa (`/admin`)** — protegida por login. Apenas profissionais de TI cadastrados podem cadastrar programas, fazer upload de instaladores, editar, remover e baixar o agente Windows.

## Modelo de acesso

- Autenticação por **e-mail + senha** (sem Google, pois é uso interno de TI).
- E-mails confirmados automaticamente (sem verificação por e-mail) para agilizar a criação de contas internas.
- Papel `admin` controlado em tabela separada `user_roles` (padrão de segurança Lovable — nunca em `profiles`).
- O **primeiro usuário** que se cadastrar vira admin automaticamente (bootstrap). Depois disso, novos cadastros entram como `pending` e precisam ser promovidos por um admin existente.
- Admins existentes podem promover, despromover e remover outros usuários da tela de gerenciamento.

## Mudanças no banco (migration)

1. Criar enum `app_role` com valores `admin`, `pending`.
2. Criar tabela `user_roles (id, user_id → auth.users, role app_role, created_at)` com `unique(user_id, role)` e RLS habilitado.
3. Criar função `has_role(_user_id uuid, _role app_role)` `SECURITY DEFINER` para evitar recursão de RLS.
4. Criar tabela `profiles (id → auth.users, email, full_name, created_at)` para listar usuários na tela de gerenciamento.
5. Trigger `on_auth_user_created` que:
   - insere em `profiles`
   - se for o **primeiro usuário** do sistema, insere `('admin')` em `user_roles`; senão insere `('pending')`.
6. **Ajustar RLS de `programs`** (hoje totalmente pública para escrita):
   - `SELECT`: continua público (catálogo aberto).
   - `INSERT/UPDATE/DELETE`: somente quando `has_role(auth.uid(), 'admin')`.
7. **Ajustar políticas do bucket `installers`**:
   - `SELECT` público (o agente baixa o instalador).
   - `INSERT/UPDATE/DELETE` somente para admins.
8. RLS de `user_roles` e `profiles`: usuário lê o próprio registro; admins leem/escrevem todos.

## Mudanças no frontend

### Novas rotas (`src/App.tsx`)
- `/` — catálogo público (refatorado).
- `/auth` — tela de login/cadastro.
- `/admin` — dashboard administrativo (protegido).
- `/admin/users` — gerenciamento de usuários TI (protegido).

### Novos arquivos
- `src/hooks/useAuth.tsx` — provider com `session`, `user`, `isAdmin`, `loading`. Configura `onAuthStateChange` **antes** de `getSession()` (padrão Lovable).
- `src/components/ProtectedRoute.tsx` — redireciona para `/auth` se não logado, mostra "Aguardando aprovação" se logado mas sem papel `admin`.
- `src/pages/Auth.tsx` — formulário de login + cadastro com validação Zod (email, senha mín. 8 chars).
- `src/pages/Admin.tsx` — versão atual de `Index.tsx` (catálogo + botões cadastrar/editar/remover/baixar agente) + header com nome do usuário e botão sair.
- `src/pages/AdminUsers.tsx` — tabela de usuários (`profiles` + `user_roles`) com ações: aprovar (vira `admin`), revogar acesso, excluir.

### Refatoração
- `src/pages/Index.tsx` vira o **catálogo público**: mesma estética, mas sem botões de cadastrar/editar/remover/baixar agente. Apenas busca + cards com **Instalar** e **Desinstalar**. Link discreto "Área da TI" no header levando a `/auth`.
- `ProgramCard` ganha prop `readOnly` para esconder os botões Editar/Remover na visualização pública.

### Segurança em UI
- Validação Zod em `/auth` e em `ProgramFormDialog`.
- Mensagens de erro claras: "Credenciais inválidas", "Aguardando aprovação de um administrador", etc.
- Sem armazenar papéis em `localStorage` — sempre validar via consulta a `user_roles`.

## Fluxo de uso

```text
Usuário final (sem login)
   └─> abre /  →  vê catálogo  →  clica Instalar  →  agente local executa

Profissional de TI (primeira vez)
   └─> /auth  →  Cadastrar  →  vira admin automaticamente (bootstrap)
                                   ou  →  fica "pending", outro admin aprova em /admin/users

Profissional de TI (já admin)
   └─> /auth  →  Login  →  /admin  →  cadastra/edita/remove programas, baixa agente
                                   →  /admin/users  →  aprova novos colegas
```

## Arquivos afetados

**Novos:**
- `supabase/migrations/<timestamp>_admin_auth.sql`
- `src/hooks/useAuth.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Auth.tsx`
- `src/pages/Admin.tsx`
- `src/pages/AdminUsers.tsx`

**Editados:**
- `src/App.tsx` (rotas + AuthProvider)
- `src/pages/Index.tsx` (vira catálogo público read-only)
- `src/components/ProgramCard.tsx` (prop `readOnly`)

## Fora do escopo desta entrega

- Recuperação de senha por e-mail (pode ser adicionada depois).
- Login social (Google/Apple) — não faz sentido para uso interno de TI.
- Logs de auditoria de quem instalou/cadastrou o quê (pode virar próximo passo).
