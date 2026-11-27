import { setTimeout } from 'node:timers/promises';
import { database, initialize } from '../lib/db.mjs';
import { hikcentral } from '../lib/hikcentral.mjs';
import { pollConfigured } from '../lib/ingest.mjs';

if (process.env.HIK_SYNC_ENABLED !== 'true') {
  console.log('HikCentral polling is disabled.');
  process.exit(0);
}
const provider = hikcentral({
  origin: process.env.HIK_ORIGIN,
  key: process.env.HIK_APP_KEY,
  secret: process.env.HIK_APP_SECRET,
  speedUnit: process.env.HIK_SPEED_UNIT
});

await initialize();
const args = process.argv.slice(2);
if (args.length) {
  const [command, camera, from, to] = args;
  const start = new Date(from);
  const end = new Date(to);
  if (args.length !== 4 || command !== 'backfill' || !from?.endsWith('Z') || !to?.endsWith('Z') ||
      !Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || start >= end ||
      end.valueOf() - start.valueOf() > 60 * 60 * 1000 || end.valueOf() > Date.now()) {
    throw new Error('Usage: npm run worker -- backfill CAMERA FROM_UTC TO_UTC (one hour maximum)');
  }
  try {
    await pollConfigured(provider, { camera, from: start, to: end });
  } finally {
    await database().end();
  }
} else {
  const stop = new AbortController();
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => stop.abort());
  while (!stop.signal.aborted) {
    try {
      await pollConfigured(provider);
    } catch {
      console.error('Polling cycle failed before completion');
    }
    await setTimeout(60_000, undefined, { signal: stop.signal }).catch(() => {});
  }
  await database().end();
}
