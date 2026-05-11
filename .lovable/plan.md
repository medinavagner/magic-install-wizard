
# Tutorial de Instalação On-Premise — Deploy Console

Vou gerar um arquivo **PDF** (`/mnt/documents/deploy-console-on-premise.pdf`) contendo o passo a passo completo para subir o sistema em um servidor **Linux (Ubuntu/Debian)** usando **Supabase self-hosted** via Docker.

## Estrutura do documento

1. **Visão geral da arquitetura**
   - Diagrama: Servidor Linux → Supabase (Postgres + Auth + Storage + Edge Functions) + Frontend (Nginx) → Estações Windows com DeployConsole
   - Portas, fluxo de dados, requisitos de rede interna

2. **Pré-requisitos do servidor**
   - Ubuntu 22.04 LTS (ou Debian 12), 4 vCPU, 8 GB RAM, 100 GB SSD
   - Docker Engine + Docker Compose v2
   - Git, Nginx, Certbot (TLS interno opcional)
   - DNS interno apontando `deploy.suaempresa.local` para o servidor

3. **Instalação do Supabase self-hosted**
   - `git clone https://github.com/supabase/supabase`
   - Cópia de `docker/.env.example` → `.env` e configuração de:
     - `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`
     - `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`
     - SMTP interno para e-mails de auth
   - `docker compose up -d`
   - Verificação do Studio em `http://servidor:8000`

4. **Aplicar o schema do Deploy Console**
   - Script SQL com tudo que existe hoje:
     - enum `app_role` (admin, pending, user)
     - tabelas `profiles`, `programs`, `user_roles`
     - funções `has_role`, `handle_new_user`, `tg_set_updated_at`
     - políticas RLS de cada tabela
     - trigger `on_auth_user_created` em `auth.users`
   - Bucket público `installers` no Storage

5. **Deploy da Edge Function `download-agent`**
   - Instalar Supabase CLI
   - `supabase link` apontando para a instância local
   - `supabase functions deploy download-agent --no-verify-jwt`
   - Teste com `curl`

6. **Build e publicação do frontend**
   - Clonar o repositório do projeto
   - Criar `.env` com `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` apontando para o Supabase local
   - `npm ci && npm run build`
   - Servir `dist/` via Nginx (config completa no PDF, incluindo fallback SPA)

7. **TLS e domínio interno**
   - Opção A: certificado interno da empresa (CA corporativa)
   - Opção B: Let's Encrypt via DNS-01 se houver domínio público
   - Configuração de Nginx como reverse proxy para Supabase + frontend

8. **Primeiro acesso e criação do admin**
   - Cadastro pela tela `/auth` — primeiro usuário vira admin automaticamente (via `handle_new_user`)
   - Aprovar usuários `pending` em `/admin/users`

9. **Distribuição do DeployConsole para as estações**
   - Como a URL embutida no instalador aponta para o Supabase local
   - Compartilhamento via GPO, share de rede ou link direto

10. **Operação e manutenção**
    - Backup do volume Postgres (`pg_dump` agendado via cron)
    - Backup do bucket `installers`
    - Logs: `docker compose logs -f`
    - Atualização do Supabase e do frontend
    - Rotação de chaves JWT

11. **Troubleshooting**
    - CORS, e-mails de confirmação, RLS bloqueando insert, upload >50 MB no bucket, certificado autoassinado nas estações

## Como vou gerar

- Script Python com **ReportLab** (Platypus) — capa, sumário, headings, blocos de código com fundo cinza, tabelas de portas/variáveis
- Tipografia: Helvetica (títulos) + Helvetica para corpo, código em Courier
- QA obrigatório: converter PDF para imagens com `pdftoppm` e revisar página por página antes de entregar
- Saída final: `<presentation-artifact>` apontando para `/mnt/documents/deploy-console-on-premise.pdf`

## O que NÃO está no escopo (você escolheu apenas Self-host do Supabase)

- Build/deploy do frontend será mencionado de forma resumida no item 6 (necessário para o sistema funcionar), mas o foco é o Supabase
- Não cobrirei Windows Server nem distribuição via GPO em profundidade
- Não cobrirei Edge Functions além da `download-agent` (única usada hoje)

Confirma que posso gerar o PDF assim?
