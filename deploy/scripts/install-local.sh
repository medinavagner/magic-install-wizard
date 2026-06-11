#!/usr/bin/env bash
###############################################################
# Instalação LOCAL (localhost, sem domínio, sem HTTPS).
# Roda em Debian/Ubuntu, macOS ou WSL2 com Docker já instalado.
# Acesso final: http://localhost:8080
###############################################################
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEPLOY_DIR="$( dirname "$SCRIPT_DIR" )"
cd "$DEPLOY_DIR"

if ! command -v docker >/dev/null; then
  echo "❌ Docker não encontrado. Instale o Docker Desktop ou Docker Engine antes."
  exit 1
fi
if ! command -v node >/dev/null; then
  echo "❌ Node.js não encontrado (necessário para gerar os JWT). Instale Node >= 18."
  exit 1
fi

PORT="${PORT:-8080}"
PUBLIC_URL="http://localhost:${PORT}"

echo "==> 1/3 Gerando .env para modo localhost"
if [[ ! -f .env ]]; then
  cp .env.example .env
  JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n=' | head -c 60)"
  PG_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  DASH_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
  sed -i.bak "s|TROQUE_ESTA_SENHA_FORTE_DO_BANCO|${PG_PASS}|g" .env
  sed -i.bak "s|TROQUE_POR_UMA_STRING_ALEATORIA_DE_NO_MINIMO_40_CARACTERES|${JWT_SECRET}|g" .env
  sed -i.bak "s|TROQUE_ESTA_SENHA$|${DASH_PASS}|g" .env

  KEYS="$(JWT_SECRET="$JWT_SECRET" node "$SCRIPT_DIR/gen-jwt.cjs")"
  ANON="$(echo "$KEYS"    | grep ^ANON_KEY=         | cut -d= -f2-)"
  SERVICE="$(echo "$KEYS" | grep ^SERVICE_ROLE_KEY= | cut -d= -f2-)"
  sed -i.bak "s|COLE_AQUI_O_TOKEN_ANON_GERADO|${ANON}|g" .env
  sed -i.bak "s|COLE_AQUI_O_TOKEN_SERVICE_ROLE_GERADO|${SERVICE}|g" .env

  # ajusta URLs para localhost
  sed -i.bak "s|^DOMAIN=.*|DOMAIN=localhost|"                              .env
  sed -i.bak "s|^LETSENCRYPT_EMAIL=.*|LETSENCRYPT_EMAIL=admin@localhost|"  .env
  sed -i.bak "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=${PUBLIC_URL}|" .env
  sed -i.bak "s|^SITE_URL=.*|SITE_URL=${PUBLIC_URL}|"                      .env
  sed -i.bak "s|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=${PUBLIC_URL}|" .env
  sed -i.bak "s|^VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=${PUBLIC_URL}|"    .env
  rm -f .env.bak
  echo "    .env criado para http://localhost:${PORT}"
else
  echo "    .env já existe — mantendo."
fi

echo "==> 2/3 Subindo stack (modo local, sem SSL)"
docker compose -f docker-compose.yml -f docker-compose.local.yml pull
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build

echo "==> 3/3 Pronto"
echo ""
echo "✅ App:     http://localhost:${PORT}"
echo "   API:    http://localhost:${PORT}/rest/v1/"
echo "   Auth:   http://localhost:${PORT}/auth/v1/"
echo ""
echo "Logs:  docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f"
echo "Parar: docker compose -f docker-compose.yml -f docker-compose.local.yml down"
