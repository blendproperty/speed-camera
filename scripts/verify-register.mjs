import { createInterface } from 'node:readline';
import { hikcentral } from '../lib/hikcentral.mjs';
import { registerConfig } from '../lib/register-config.mjs';

process.exitCode = await verify(process.argv[2]);

async function verify(mode) {
  if (!['tls', 'lookup'].includes(mode)) {
    console.error('Usage: node scripts/verify-register.mjs tls|lookup');
    return 2;
  }
  let url;
  let config;
  try {
    config = await registerConfig();
    const { origin } = config;
    url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) throw new Error();
  } catch {
    console.error('Check the HTTPS gateway origin and pinned certificate configuration.');
    return 2;
  }
  try {
    // This HikCentral listener closes HEAD requests even when its TLS handshake succeeds.
    const response = await config.send(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) });
    await response.body?.cancel();
    console.log('Gateway TLS verified. HTTP ' + response.status + '.');
  } catch {
    console.error('Gateway TLS or connectivity check failed.');
    return 1;
  }
  if (mode === 'tls') return 0;
  if (!config.key || !config.secret || !config.group) {
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
    const result = await hikcentral(config).registeredVehicle(plate.trim(), captured, config.group);
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
