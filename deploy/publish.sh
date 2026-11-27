#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."

host=${1:-speed-camera.srv938083.hstgr.cloud}
if [[ "$(id -u)" != 0 || ! -f .env || ! "$host" =~ ^[a-z0-9][a-z0-9.-]+\.[a-z]+$ ]]; then
  printf '%s\n' 'Run with sudo from an initialized VPS pilot and supply a valid HTTPS hostname.' >&2
  exit 1
fi
docker network inspect root_default >/dev/null
docker image inspect midpoint-speed-camera:local >/dev/null

public=(docker compose -f compose.yaml -f compose.traefik.yaml)
private=(docker compose -f compose.yaml -f compose.local.yaml)
saved=$(mktemp .env.prepublish.XXXXXX)
next=$(mktemp .env.publish.XXXXXX)
cp -p .env "$saved"
trap 'rm -f -- "$next" "$saved"' EXIT
awk '!/^(PUBLIC_ORIGIN|SPEED_CAMERA_HOST)=/' .env > "$next"
printf 'PUBLIC_ORIGIN=https://%s\nSPEED_CAMERA_HOST=%s\n' "$host" "$host" >> "$next"
docker compose --env-file "$next" -f compose.yaml -f compose.traefik.yaml config --quiet
mv -f -- "$next" .env

if "${public[@]}" up -d --no-build --no-deps --wait web; then
  for attempt in {1..24}; do
    if curl -fsS --max-time 5 "https://$host/api/health" | grep -Fq '"status":"ok"' &&
       curl -fsS --max-time 5 "https://$host/login" | grep -Fq 'Operator sign in' &&
       [[ "$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "https://$host/api/export")" == 401 ]] &&
       [[ "$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' \
         -H "Origin: https://$host" --data 'username=&password=' "https://$host/api/auth")" == 303 ]]; then
      printf 'Published and verified https://%s/login\n' "$host"
      exit 0
    fi
    sleep 5
  done
fi

printf '%s\n' 'HTTPS checks failed. Restoring previous web configuration.' >&2
mv -f -- "$saved" .env
if grep -q '^PUBLIC_ORIGIN=https://' .env; then
  "${public[@]}" up -d --no-build --no-deps --wait web
else
  "${private[@]}" up -d --no-build --no-deps --wait web
fi
exit 1
