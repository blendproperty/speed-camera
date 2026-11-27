import { database, transaction } from './db.mjs';
import { normalize, pageSize } from './hikcentral.mjs';

const hour = 60 * 60 * 1000;
const overlap = 10 * 60 * 1000;
const settle = 60 * 1000;

export function captureStatus(speed, limit, plate, evidence) {
  if (speed === null) return 'unmeasured';
  if (speed <= Number(limit)) return 'within_limit';
  return plate && evidence ? 'pending' : 'held';
}

export async function pollCamera(client, provider, camera, now = new Date(), range) {
  const end = range?.to ?? new Date(Math.min(now.valueOf() - settle, camera.cursor_at
    ? camera.cursor_at.valueOf() + hour : now.valueOf()));
  const begin = range?.from ?? new Date((camera.cursor_at ?? end).valueOf() - (camera.cursor_at ? overlap : hour));
  if (begin >= end) return 0;
  let count = 0;
  let total;
  for (let page = 1; page <= 100; page++) {
    const batch = await provider.records(camera.code, begin, end, page);
    total ??= batch.total;
    if (batch.total !== total || batch.records.length !== Math.min(pageSize, Math.max(total - count, 0))) {
      throw new Error('Incomplete or changing HikCentral result pages');
    }
    for (const raw of batch.records) {
      const record = normalize(raw, camera.code, provider.speedUnit);
      if (record.captured < begin || record.captured > end) throw new Error('HikCentral returned a capture outside the requested window');
      await saveCapture(client, provider, camera, record);
    }
    count += batch.records.length;
    if (count >= total) {
      await client.query(
        `UPDATE cameras SET cursor_at=CASE WHEN $3 THEN cursor_at ELSE $2 END,
         last_poll_at=now(), poll_error=NULL WHERE code=$1`,
        [camera.code, end, Boolean(range)]
      );
      return count;
    }
  }
  throw new Error('HikCentral result window exceeded 100 pages. Split the window before continuing.');
}

async function saveCapture(client, provider, camera, record) {
  const existing = (await client.query(
    'SELECT status, limit_kmh, speed_kmh, plate, image_sha256 FROM captures WHERE camera_code=$1 AND provider_id=$2',
    [camera.code, record.id]
  )).rows[0];
  if (existing && !['unmeasured', 'held'].includes(existing.status)) return;
  const limit = existing?.limit_kmh ?? camera.limit_kmh;
  const speed = existing?.speed_kmh == null ? record.speed : Number(existing.speed_kmh);
  const plate = existing?.plate ?? record.plate;
  let image;
  if (plate && speed !== null && speed > Number(limit) && record.pic) {
    try {
      image = await provider.image(record.pic);
    } catch {
      // Keep the capture on hold so a later poll or targeted backfill can retry the picture.
    }
  }
  await client.query(
    `INSERT INTO captures(camera_code,provider_id,captured_at,plate,speed_kmh,limit_kmh,
      image_reference,image_bytes,image_type,image_sha256,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (camera_code, provider_id) DO UPDATE SET
        plate=EXCLUDED.plate, speed_kmh=EXCLUDED.speed_kmh,
        image_reference=COALESCE(EXCLUDED.image_reference,captures.image_reference),
        image_bytes=EXCLUDED.image_bytes,image_type=EXCLUDED.image_type,
        image_sha256=EXCLUDED.image_sha256,status=EXCLUDED.status
      WHERE captures.status IN ('unmeasured','held')`,
    [camera.code, record.id, record.captured, plate, speed, limit, record.pic,
      image?.bytes ?? null, image?.type ?? null, image?.hash ?? null,
      captureStatus(speed, limit, plate, image)]
  );
  await client.query(
    'UPDATE cameras SET last_capture_at=GREATEST(last_capture_at,$2) WHERE code=$1',
    [camera.code, record.captured]
  );
}

export async function pollConfigured(provider, range) {
  const cameras = await database().query(
    'SELECT code FROM cameras WHERE ($1::text IS NULL AND enabled) OR code=$1 ORDER BY code',
    [range?.camera ?? null]
  );
  if (range && !cameras.rowCount) throw new Error('Camera not configured');
  for (const { code } of cameras.rows) {
    try {
      await transaction(async (client) => {
        const locked = await client.query('SELECT * FROM cameras WHERE code=$1 FOR UPDATE SKIP LOCKED', [code]);
        if (!locked.rowCount) {
          if (range) throw new Error('Camera is currently being synced');
          return;
        }
        if (locked.rows[0].enabled || range) await pollCamera(client, provider, locked.rows[0], new Date(), range);
      });
    } catch (error) {
      const candidate = error instanceof SyntaxError ? 'Invalid HikCentral JSON response' : error.message;
      const summary = /^(HikCentral |Unexpected HikCentral|Invalid HikCentral|Incomplete or changing HikCentral)/.test(candidate)
        ? candidate.slice(0, 180) : 'Capture sync failed';
      await database().query('UPDATE cameras SET poll_error=$2 WHERE code=$1', [code, summary]);
      if (range) throw new Error(summary);
    }
  }
}
