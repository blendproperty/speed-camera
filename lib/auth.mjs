import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';

const derive = promisify(scrypt);
export const sessionName = 'midpoint_speed_session';
export const sessionDuration = 8 * 60 * 60;

async function operators() {
  const file = process.env.OPERATORS_FILE;
  return file ? JSON.parse(await readFile(file, 'utf8')) : {};
}

export async function authenticate(username, password) {
  const users = await operators();
  const record = Object.hasOwn(users, username) ? users[username] : null;
  const [salt, hash] = (record ?? '0'.repeat(32) + ':' + '0'.repeat(128)).split(':');
  const got = await derive(password, salt, 64);
  return timingSafeEqual(got, Buffer.from(hash, 'hex')) && record ? record : null;
}

function sign(payload, credential) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return createHmac('sha256', secret).update(payload + ':' + credential).digest('base64url');
}

export function issueSession(username, credential) {
  const session = {
    username,
    expires: Math.floor(Date.now() / 1000) + sessionDuration,
    csrf: randomBytes(24).toString('base64url')
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return payload + '.' + sign(payload, credential);
}

export async function currentSession() {
  const token = (await cookies()).get(sessionName)?.value;
  if (!token || token.length > 1000) return null;
  const [payload, signature, extra] = token.split('.');
  if (!signature || extra !== undefined) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
  if (!data || !validUsername(data.username) || typeof data.csrf !== 'string' ||
      !Number.isSafeInteger(data.expires) || data.expires <= Date.now() / 1000) return null;
  const users = await operators();
  if (!Object.hasOwn(users, data.username)) return null;
  const expected = Buffer.from(sign(payload, users[data.username]));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied) ? data : null;
}

export function validUsername(username) {
  return typeof username === 'string' && /^[a-z0-9][a-z0-9._-]{1,63}$/.test(username);
}

export function sameOrigin(request) {
  const configured = process.env.PUBLIC_ORIGIN;
  return !!configured && request.headers.get('origin') === new URL(configured).origin;
}

export async function readForm(request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded' ||
      !request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  } finally {
    reader.releaseLock();
  }
}
