import { audit, transaction } from './db.mjs';

export const statuses = {
  pending: 'Ready for review',
  held: 'Evidence missing',
  approved: 'Approved internally',
  dismissed: 'Dismissed',
  within_limit: 'Within limit',
  unmeasured: 'Speed unavailable'
};

export function formatTime(date) {
  return date ? new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg', hourCycle: 'h23'
  }).format(new Date(date)) : '–';
}

export class InputError extends Error {}

export async function saveCamera(form, actor) {
  const code = String(form.get('code') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const limit = String(form.get('limit') ?? '');
  const enabled = form.get('enabled') === 'on';
  if (!/^[\w.-]{1,64}$/.test(code) || !name || name.length > 100 ||
      !/^\d{1,3}(?:\.\d)?$/.test(limit) || +limit <= 0 || +limit > 160) {
    throw new InputError('Enter a valid camera code, name and speed limit.');
  }
  await transaction(async (client) => {
    const previous = await client.query('SELECT name,limit_kmh,enabled FROM cameras WHERE code=$1 FOR UPDATE', [code]);
    await client.query(
      `INSERT INTO cameras(code,name,limit_kmh,enabled) VALUES($1,$2,$3,$4)
       ON CONFLICT(code) DO UPDATE SET name=$2,limit_kmh=$3,enabled=$4`,
      [code, name, limit, enabled]
    );
    await audit(client, actor, 'camera_saved', code, {
      previous: previous.rows[0] ?? null, name, limit, enabled
    });
  });
}

export async function reviewCapture(id, form, actor) {
  const decision = form.get('decision');
  const note = String(form.get('note') ?? '').trim();
  if (!validId(id) || !['approved', 'dismissed'].includes(decision) || !note || note.length > 500) {
    throw new InputError('Select a decision and provide a reason up to 500 characters.');
  }
  await transaction(async (client) => {
    const result = await client.query(
      `UPDATE captures SET status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4
        WHERE id=$1 AND (
          ($2='dismissed' AND status IN ('held','pending')) OR
          ($2='approved' AND status='pending' AND speed_kmh>limit_kmh AND
           length(trim(plate))>0 AND image_bytes IS NOT NULL AND image_sha256 IS NOT NULL)
        ) RETURNING id`,
      [id, decision, actor, note]
    );
    if (!result.rowCount) throw new InputError('This capture is no longer eligible for that decision.');
    await audit(client, actor, 'capture_' + decision, id, { reason: note });
  });
}

export function validId(id) {
  return typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
}

export function csvCell(value) {
  const raw = String(value ?? '');
  const neutral = /^(?:\s*[=+@-]|[\t\r\n])/.test(raw) ? "'" + raw : raw;
  return '"' + neutral.replaceAll('"', '""') + '"';
}
