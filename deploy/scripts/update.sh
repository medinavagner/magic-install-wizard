#!/usr/bin/env bash
# Atualiza a aplicação após git pull
set -euo pipefail
cd "$( dirname "$0" )/.."
git -C .. pull --ff-only
docker compose pull
docker compose up -d --build
docker compose ps
