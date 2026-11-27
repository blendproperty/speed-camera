#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if [[ "$(id -u)" != 0 ]]; then
  printf '%s\n' 'Run as the VPS administrator so the operator directory can be assigned to the container user.'
  exit 1
fi
docker info >/dev/null
if [[ ! -f .env ]]; then
  {
    printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'PUBLIC_ORIGIN=http://127.0.0.1:3189\nLOCAL_PORT=3189\nHIK_SYNC_ENABLED=false\n'
  } > .env
fi
install -d -m 700 secrets
install -d -m 700 -o 1000 -g 1000 secrets/operators
stack=(docker compose -f compose.yaml -f compose.local.yaml)
"${stack[@]}" build web
if [[ ! -f secrets/operators/operators.json ]]; then
  "${stack[@]}" run --rm -T --no-deps -v "$PWD/secrets/operators:/operator-setup" \
    -e OPERATORS_FILE=/operator-setup/operators.json web node scripts/operator.mjs pilot add > secrets/initial-pilot-password
  chmod 600 secrets/initial-pilot-password
  printf '%s\n' 'Created pilot operator. Initial password is in secrets/initial-pilot-password.'
fi
"${stack[@]}" up -d --wait db web
curl --silent --show-error --fail http://127.0.0.1:3189/api/health
