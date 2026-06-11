#!/usr/bin/env bash
###############################################################
# Instalação automatizada em Debian 12 (bookworm) / Ubuntu 22+
# Instala dependências, gera segredos e sobe a stack completa.
###############################################################
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEPLOY_DIR="$( dirname "$SCRIPT_DIR" )"
REPO_DIR="$( dirname "$DEPLOY_DIR" )"
cd "$DEPLOY_DIR"

echo "==> 1/6 Atualizando sistema e instalando dependências base"
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release openssl ufw git nodejs

echo "==> 2/6 Instalando Docker Engine + Compose plugin"
if ! command -v docker >/dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/debian $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER" || true
fi

echo "==> 3/6 Configurando firewall (portas 22/80/443)"
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp  || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

echo "==> 4/6 Gerando arquivo .env (se ainda não existe)"
if [[ ! -f .env ]]; then
  cp .env.example .env
  JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n=' | head -c 60)"
  PG_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  DASH_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
  sed -i "s|TROQUE_ESTA_SENHA_FORTE_DO_BANCO|${PG_PASS}|g" .env
  sed -i "s|TROQUE_POR_UMA_STRING_ALEATORIA_DE_NO_MINIMO_40_CARACTERES|${JWT_SECRET}|g" .env
  sed -i "s|TROQUE_ESTA_SENHA$|${DASH_PASS}|g" .env

  echo "    -> gerando ANON_KEY e SERVICE_ROLE_KEY"
  KEYS="$(JWT_SECRET="$JWT_SECRET" node "$SCRIPT_DIR/gen-jwt.cjs")"
  ANON="$(echo "$KEYS"    | grep ^ANON_KEY=         | cut -d= -f2-)"
  SERVICE="$(echo "$KEYS" | grep ^SERVICE_ROLE_KEY= | cut -d= -f2-)"
  sed -i "s|COLE_AQUI_O_TOKEN_ANON_GERADO|${ANON}|g" .env
  sed -i "s|COLE_AQUI_O_TOKEN_SERVICE_ROLE_GERADO|${SERVICE}|g" .env

  echo ""
  echo "    .env criado. EDITE-O agora para ajustar:"
  echo "      - DOMAIN, LETSENCRYPT_EMAIL"
  echo "      - SUPABASE_PUBLIC_URL, SITE_URL"
  echo "      - SMTP_* (e-mail de cadastro/recuperação)"
  echo ""
  read -rp "Pressione ENTER após editar deploy/.env para continuar..."
fi

# carrega DOMAIN/EMAIL
set -a; source .env; set +a

echo "==> 5/6 Emitindo certificado SSL para ${DOMAIN}"
mkdir -p ./certbot/conf ./certbot/www
if [[ ! -d "./certbot/conf/live/${DOMAIN}" ]]; then
  # sobe nginx mínimo só para o desafio ACME
  docker run --rm -d --name nginx-acme -p 80:80 \
    -v "$PWD/certbot/www:/var/www/certbot" \
    -v "$PWD/nginx/acme.conf:/etc/nginx/conf.d/default.conf:ro" \
    nginx:1.27-alpine || true

  cat > nginx/acme.conf <<EOF
server {
  listen 80; server_name ${DOMAIN};
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 200 "ok"; }
}
EOF
  docker restart nginx-acme >/dev/null || true

  docker run --rm \
    -v "$PWD/certbot/conf:/etc/letsencrypt" \
    -v "$PWD/certbot/www:/var/www/certbot" \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    --email "${LETSENCRYPT_EMAIL}" --agree-tos --no-eff-email \
    -d "${DOMAIN}"

  docker rm -f nginx-acme >/dev/null || true
fi

echo "==> 6/6 Subindo stack completa"
docker compose pull
docker compose up -d --build

echo ""
echo "✅ Pronto! Acesse: https://${DOMAIN}"
echo "   Studio (admin Supabase): https://${DOMAIN}/studio  (se exposto via nginx)"
echo "   Logs:  docker compose logs -f"
