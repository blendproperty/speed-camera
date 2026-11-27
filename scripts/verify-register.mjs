import { createInterface } from 'node:readline';
import { hikcentral } from '../lib/hikcentral.mjs';

const { HIK_REGISTER_ORIGIN: origin, HIK_REGISTER_APP_KEY: key,
  HIK_REGISTER_APP_SECRET: secret, HIK_REGISTER_GROUP_ID: group } = process.env;
process.exitCode = await verify(process.argv[2]);

async function verify(mode) {
  if (!['tls', 'lookup'].includes(mode)) {
    console.error('Usage: node scripts/verify-register.mjs tls|lookup');
    return 2;
  }
  let url;
  try {
    url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) throw new Error();
  } catch {
    console.error('Set HIK_REGISTER_ORIGIN to the HTTPS gateway origin.');
    return 2;
  }
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) });
    console.log('Gateway TLS verified. HTTP ' + response.status + '.');
  } catch {
    console.error('Gateway TLS or connectivity check failed.');
    return 1;
  }
  if (mode === 'tls') return 0;
  if (!key || !secret || !group) {
    console.error('Set the scoped register key, secret and vehicle group ID.');
    return 2;
  }
  const input = createInterface({ input: process.stdin, output: process.stdout, crlfDelay: Infinity });
  let plate = '';
  let captureTime = '';
  try {
    console.log('Enter the approved test plate, then the capture time (ISO 8601 with time zone).');
    const lines = input[Symbol.asyncIterator]();
    plate = (await lines.next()).value ?? '';
    captureTime = (await lines.next()).value ?? '';
  } finally {
    input.close();
  }
  const captured = new Date(captureTime);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(captureTime) || Number.isNaN(captured.valueOf())) {
    console.error('Enter a valid capture time with its time zone.');
    return 2;
  }
  try {
    const result = await hikcentral({ origin, key, secret }).registeredVehicle(plate.trim(), captured, group);
    if (result.status !== 'match') {
      console.error('Register check: ' + result.status + '.');
      return 1;
    }
    console.log('One effective match. Fields returned: ' +
      ['owner', 'make', 'colour'].filter((field) => result[field]).join(', ') + '.');
    return 0;
  } catch {
    console.error('The signed lookup failed. Check the gateway calling record, group ID and partner permissions.');
    return 1;
  }
}
