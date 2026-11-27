# Midpoint Speed Monitoring

An internal operator console for HikCentral vehicle passes, speed measurements and evidence. It uses Next.js, PostgreSQL, Docker Compose and Traefik, following the EMS deployment pattern with its own database, secrets and containers.

## Operator workflow

1. Sign in and add the exact HikCentral camera ID, location name and posted speed limit.
2. Check each camera’s last successful sync and last captured pass. The review queue separates incomplete evidence from captures ready for a decision.
3. Open the photo, compare it with the plate, capture time and measured speed, then record an internal approval or dismissal with a reason.
4. Download the approved CSV for administrative handoff. The export includes the provider capture ID, time, camera, plate, speed, applicable limit, photo SHA-256 and reviewer. Evidence is retrieved through the authenticated console. Approval does not issue a ticket or contact a driver.

## First VPS deployment

Use a dedicated directory and keep the service private during setup. On the VPS, a Docker administrator runs:

```sh
sudo bash deploy/stage-pilot.sh
```

The script generates independent PostgreSQL and session credentials, creates a `pilot` account, builds the containers and checks application health. Read `secrets/initial-pilot-password` directly on the server and deliver it through the existing private credential channel. Remove the plaintext file after delivery. Access the pilot through an SSH tunnel:

```sh
ssh -N -L 3189:127.0.0.1:3189 stor24-admin
```

Open `http://127.0.0.1:3189`. Add or revoke named operators with the following command run from the checkout as a Docker administrator. Replace `add` with `remove` to revoke. Adding an existing username rotates its password and invalidates its existing sessions.

```sh
docker compose run --rm -T --no-deps -v "$PWD/secrets/operators:/operator-setup" \
  -e OPERATORS_FILE=/operator-setup/operators.json web node scripts/operator.mjs USERNAME add
```

For approved HTTPS access, set `SPEED_CAMERA_HOST` to the chosen DNS name and `PUBLIC_ORIGIN=https://<that host>` in the private `.env`. Verify the TLS resolver and network used by the VPS Traefik installation. The override defaults to the EMS network `root_default`, entrypoints `web` and `websecure`, and resolver `mytlschallenge`.

```sh
docker compose -f compose.yaml -f compose.traefik.yaml up -d --build --wait db web
```

This replacement uses the same PostgreSQL volume and removes the pilot’s loopback port from the web service. Verify TLS and `/api/health`, that protected endpoints reject unauthenticated requests, and that a named operator can sign in and sign out. PostgreSQL has no published port and is connected to a separate Docker network from Traefik.

## HikCentral connection

Leave polling off until the gateway credentials and camera IDs are ready. Store secrets only in the private `.env` on the VPS. The web container and PostgreSQL do not receive the HikCentral AppSecret.

- Set `HIK_ORIGIN` to the gateway HTTPS origin, `HIK_APP_KEY` and `HIK_APP_SECRET` to authorized read-only Artemis credentials, and `HIK_CONTAINER_CA` if a private CA bundle is required. Use a CA and hostname that the gateway certificate validates.
- Set `HIK_SYNC_ENABLED=true` and start the worker with `docker compose -f compose.yaml -f compose.traefik.yaml --profile sync up -d --build`. Use `compose.local.yaml` in place of the Traefik override for the private pilot.
- Check a real sample against the camera. Confirm the capture ID, camera ID, time, registration, speed, speed unit and matching evidence photo. Set `HIK_SPEED_UNIT=kmh` or `mph` after confirming the unit, then recreate the worker. Until configured, captures have unknown speed. A reported zero is treated as unavailable because it could be a device default.
- The worker calls `/artemis/api/pms/v1/crossRecords/page` and `/artemis/api/pms/v1/image` under the signed gateway. It polls each camera approximately every minute, holds the newest minute for the provider to settle, and rechecks a 10-minute overlap after successful windows. The first sync covers the prior hour. A failed page rolls back all work for that camera window. An above-limit capture with unavailable evidence stays held.
- For a specific missed period or to retry older held evidence, run `docker compose --profile sync run --rm worker node scripts/worker.mjs backfill CAMERA FROM_UTC TO_UTC` with an ISO UTC range of one hour or less. Repeat with consecutive smaller windows for dense results. Backfill does not change the forward checkpoint. Results are deduplicated by camera ID and HikCentral capture ID.

The application takes the speed limit from the camera setting at first import. Verify the applicable limit and calibration against the capture time before reviewing any historical backfill. Review decisions and their source capture are preserved when the polling window overlaps an earlier import.

- [Hikvision vehicle-passing response schema](https://enpinfo.hikvision.com/hkwsen/unzip/20260723200832_95640_doc/GUID-CD767476-5C90-4E96-8781-A06436863261.html)
- [Hikvision evidence image API](https://enpinfo.hikvision.com/hkwsen/unzip/20260723200832_95640_doc/GUID-5C0F1BD5-2AD6-410C-9526-DAFE6CFC4F13.html)
- [Hikvision Artemis signature](https://enpinfo.hikvision.com/hkwsen/unzip/20260723200832_95640_doc/GUID-AC08DDFF-62E1-48F6-8D12-1DE85DDCDB20.html)

## Operations

- Run `npm ci`, `npm test` and `npm run build` for source validation. `scripts/smoke.mjs` exercises the built web and a dedicated PostgreSQL database with a synthetic provider. It needs an operator named `smoke` and the `SMOKE_URL`, `SMOKE_ORIGIN`, `SMOKE_PASSWORD`, `DATABASE_URL` and `SMOKE_FIXTURES=explicitly-disposable` environment variables. Run it only against a disposable database.
- Before changing the VPS stack, save a PostgreSQL custom-format dump to a private directory using `docker compose exec -T db pg_dump -U speed_camera -d speed_camera -Fc`. Restore into a separate PostgreSQL instance to verify recoverability. Back up the private runtime configuration using the approved credential storage.
- Keep the pilot internal until provider validation, camera and limit verification, operator acceptance, backup recovery and the policy for access, retention and ticketing handoff have been approved.
