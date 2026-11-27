import assert from 'node:assert/strict';
import { database, initialize, transaction } from '../lib/db.mjs';
import { pollCamera } from '../lib/ingest.mjs';

const base = process.env.SMOKE_URL;
const origin = process.env.SMOKE_ORIGIN;
const password = process.env.SMOKE_PASSWORD;
assert.ok(base && origin && password && process.env.SMOKE_FIXTURES === 'explicitly-disposable',
  'Set SMOKE_URL, SMOKE_ORIGIN, SMOKE_PASSWORD and SMOKE_FIXTURES on an isolated database only');
const camera = 'smoke-' + Date.now();
const call = (path, options) => fetch(base + path, { redirect: 'manual', ...options });
const form = (path, data, cookie, requestOrigin = origin) => call(path, {
  method: 'POST', body: new URLSearchParams(data), headers: { origin: requestOrigin, ...(cookie ? { cookie } : {}) }
});

try {
  assert.equal((await call('/api/health')).status, 200);
  assert.equal((await call('/login')).headers.get('referrer-policy'), 'same-origin');
  assert.equal((await call('/api/export')).status, 401);
  assert.equal((await call('/api/evidence/1')).status, 401);
  assert.equal((await form('/api/auth', { username: 'smoke', password }, null, 'https://invalid.example')).status, 403);
  assert.equal((await form('/api/auth', { username: 'smoke', password }, null, 'null')).status, 403);
  const login = await form('/api/auth', { username: 'smoke', password });
  assert.equal(login.status, 303);
  assert.equal(new URL(login.headers.get('location')).pathname, '/');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const cameras = await call('/cameras', { headers: { cookie } });
  assert.equal(cameras.status, 200);
  const match = (await cameras.text()).match(/name="csrf" value="([^"]+)"/);
  assert.ok(match, 'camera form must issue CSRF token');
  const csrf = match[1];
  const settings = { code: camera, name: 'Synthetic only', limit: '30', enabled: 'on' };
  assert.equal((await form('/api/actions/camera', settings, cookie)).status, 403);
  assert.equal((await form('/api/actions/camera', { ...settings, csrf }, cookie)).status, 303);

  await initialize();
  const when = new Date(Date.now() - 3 * 60_000);
  const records = [46, 45, 30, null].map((speed, i) => ({
    crossRecordSyscode: 'fixture-' + i, cameraIndexCode: camera, crossTime: when.toISOString(),
    plateNo: 'SYNTHETIC ' + i, vehicleSpeed: speed, vehiclePicUri: i === 0 ? '/synthetic' : null
  }));
  const jpeg = Buffer.from([255, 216, 255, 123, 255, 217]);
  const provider = {
    speedUnit: 'kmh', records: async () => ({ total: records.length, records }),
    image: async () => ({ bytes: jpeg, type: 'image/jpeg', hash: 'a'.repeat(64) })
  };
  const run = () => transaction(async (client) => {
    const configured = await client.query('SELECT * FROM cameras WHERE code=$1 FOR UPDATE', [camera]);
    await pollCamera(client, provider, configured.rows[0]);
  });
  await run();
  await run();
  const { rows } = await database().query('SELECT id,status FROM captures WHERE camera_code=$1 ORDER BY id', [camera]);
  assert.deepEqual(rows.map((row) => row.status), ['pending', 'held', 'within_limit', 'unmeasured']);
  const [pending, held] = rows;
  assert.equal((await form('/api/actions/review', { id: held.id, decision: 'approved', note: 'Fixture', csrf }, cookie)).status, 400);
  assert.deepEqual(Buffer.from(await (await call('/api/evidence/' + pending.id, { headers: { cookie } })).arrayBuffer()), jpeg);
  const approval = { id: pending.id, decision: 'approved', note: 'Synthetic verification', csrf };
  assert.equal((await form('/api/actions/review', approval, cookie)).status, 303);
  assert.equal((await form('/api/actions/review', approval, cookie)).status, 400);
  const csv = await (await call('/api/export', { headers: { cookie } })).text();
  assert.match(csv, /Synthetic verification/);
  assert.doesNotMatch(csv, /SYNTHETIC 1/);
  assert.match(await (await call('/audit', { headers: { cookie } })).text(), /capture approved/);
  assert.equal((await form('/api/actions/logout', { csrf }, cookie)).status, 303);
  console.log('Passed isolated smoke: health, login, CSRF, setup, dedup, evidence, held gate, review, CSV, audit, logout.');
} finally {
  await database().end();
}
