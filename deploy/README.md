# DeployConsole — Self-Hosting em Debian

Este diretório contém **tudo o que é necessário** para instalar o sistema em um
servidor Debian 12 (ou Ubuntu 22.04+) usando Docker, com banco PostgreSQL,
backend Supabase self-hosted, Nginx como reverse proxy e SSL gratuito do
Let's Encrypt.

---

## 1. Pré-requisitos

### Servidor
- **SO**: Debian 12 (bookworm) ou Ubuntu 22.04 / 24.04 — 64 bits
- **CPU/RAM mínimos**: 2 vCPU, 4 GB RAM, 20 GB disco
- **CPU/RAM recomendado**: 4 vCPU, 8 GB RAM, 80 GB SSD
- Acesso `sudo` (não rode como root puro)
- Portas **80** e **443** liberadas na internet

### DNS
- Um domínio (ou subdomínio) apontando para o IP do servidor:
  - Registro **A**: `app.seudominio.com.br` → `IP.DO.SERVIDOR`
- Aguarde a propagação antes de rodar o instalador (verifique com `dig app.seudominio.com.br`).

### SMTP (opcional, mas recomendado)
Para enviar e-mails de confirmação e recuperação de senha. Pode ser:
- Amazon SES, SendGrid, Mailgun, Resend, Brevo, ou
- SMTP do próprio provedor (Gmail Workspace, Outlook 365, etc.)

---

## 2. Dependências instaladas automaticamente

O script `scripts/install.sh` instala via `apt`:

| Pacote | Versão | Função |
|---|---|---|
| `docker-ce` + `docker-compose-plugin` | latest stable | Orquestração de containers |
| `nodejs` | ≥ 18 | Gera os tokens JWT |
| `openssl` | system | Gera segredos aleatórios |
| `ufw` | system | Firewall (portas 22/80/443) |
| `git`, `curl`, `ca-certificates`, `gnupg`, `lsb-release` | system | Utilitários |

E sobe via Docker (sem instalar no host):

| Serviço | Imagem | Função |
|---|---|---|
| **db** | `supabase/postgres:15` | Banco PostgreSQL com extensões Supabase |
| **auth** | `supabase/gotrue` | Autenticação (e-mail, JWT) |
| **rest** | `postgrest/postgrest` | API REST automática do banco |
| **storage** | `supabase/storage-api` | Upload/download de arquivos (instaladores) |
| **functions** | `supabase/edge-runtime` | Edge functions Deno (ex.: `download-agent`) |
| **kong** | `kong:2.8` | API gateway (CORS, auth keys) |
| **studio** + **meta** | `supabase/studio` | Painel admin do banco |
| **frontend** | build local | App React/Vite servido por Nginx |
| **nginx** | `nginx:1.27-alpine` | Reverse proxy HTTPS público |
| **certbot** | `certbot/certbot` | Renovação automática SSL |

---

## 3. Instalação passo a passo

```bash
# 1) Clone o repositório no servidor
git clone https://github.com/SEU_USUARIO/SEU_REPO.git /opt/deployconsole
cd /opt/deployconsole/deploy

# 2) Torne os scripts executáveis
chmod +x scripts/*.sh

# 3) Execute o instalador (pedirá sudo)
./scripts/install.sh
```

O script vai:
1. Atualizar o `apt` e instalar dependências
2. Instalar Docker + Compose
3. Configurar firewall (`ufw`)
4. Criar `deploy/.env` com **segredos aleatórios** (JWT, senhas, ANON_KEY, SERVICE_ROLE_KEY)
5. **Pausar para você editar** `deploy/.env` (definir `DOMAIN`, SMTP, etc.)
6. Emitir certificado Let's Encrypt para o seu domínio
7. Subir toda a stack com `docker compose up -d --build`

Ao final, acesse: **https://app.seudominio.com.br**

O **primeiro usuário** que se cadastrar vira **admin** automaticamente
(regra na função `handle_new_user`). Os próximos ficam como `pending`
até serem aprovados pelo admin em `/admin/users`.

---

## 4. Estrutura de arquivos

```
deploy/
├── README.md               ← este arquivo
├── .env.example            ← template das variáveis (NÃO commitar .env real)
├── docker-compose.yml      ← stack completa
├── Dockerfile.frontend     ← build do React/Vite
├── kong.yml                ← config do gateway Kong
├── db/
│   └── 01-schema.sql       ← schema inicial (tabelas, RLS, triggers)
├── nginx/
│   ├── frontend.conf       ← config interna do container do frontend
│   └── app.conf.template   ← reverse proxy público com SSL
└── scripts/
    ├── install.sh          ← instalação completa
    ├── update.sh           ← git pull + rebuild
    ├── backup-db.sh        ← dump diário do Postgres
    └── gen-jwt.js          ← gera ANON_KEY / SERVICE_ROLE_KEY
```

---

## 5. Operação no dia-a-dia

```bash
cd /opt/deployconsole/deploy

# ver status
docker compose ps

# logs em tempo real
docker compose logs -f
docker compose logs -f functions       # só edge functions
docker compose logs -f auth            # só autenticação

# reiniciar um serviço
docker compose restart functions

# atualizar após git pull
./scripts/update.sh

# backup manual
./scripts/backup-db.sh
```

### Backup automático diário (cron)
```bash
sudo crontab -e
# adicione:
0 3 * * * /opt/deployconsole/deploy/scripts/backup-db.sh >> /var/log/deployconsole-backup.log 2>&1
```

### Restaurar backup
```bash
gunzip -c /var/backups/deployconsole/db-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose exec -T db psql -U postgres
```

---

## 6. Atualização SSL

Os certificados renovam **automaticamente** (container `certbot` checa a cada 12h).
Para forçar:

```bash
docker compose run --rm certbot renew --force-renewal
docker compose exec nginx nginx -s reload
```

---

## 7. Solução de problemas

| Problema | Verificar |
|---|---|
| `502 Bad Gateway` no domínio | `docker compose ps` — algum serviço parou? `docker compose logs frontend` |
| Login não envia e-mail | Variáveis `SMTP_*` no `.env`, depois `docker compose restart auth` |
| Upload de instalador falha | `docker compose logs storage`; verifique espaço em disco |
| Edge function não roda | `docker compose logs -f functions` |
| Postgres não sobe | `docker compose logs db`; confirme `POSTGRES_PASSWORD` |
| Certificado expirado | `docker compose run --rm certbot renew --force-renewal` |

---

## 8. Segurança recomendada

- Troque **todas** as senhas geradas no `.env` se desconfiar de vazamento
- Mantenha o Debian atualizado: `sudo apt-get update && sudo apt-get upgrade -y`
- Faça backup off-site (rsync para outro servidor / S3 / Backblaze)
- Não exponha a porta `5432` do Postgres na internet (já fica em `127.0.0.1`)
- Considere ativar **fail2ban** para SSH

---

## 9. Desinstalação

```bash
cd /opt/deployconsole/deploy
docker compose down -v        # remove containers + volumes (APAGA O BANCO)
sudo rm -rf /opt/deployconsole
```
