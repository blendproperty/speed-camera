import { readFile } from 'node:fs/promises';
import { X509Certificate, timingSafeEqual } from 'node:crypto';
import { request } from 'node:https';
import { Readable } from 'node:stream';

export async function registerConfig() {
  const { HIK_REGISTER_CONFIG_FILE: file, HIK_REGISTER_ORIGIN: origin, HIK_REGISTER_APP_KEY: key,
    HIK_REGISTER_APP_SECRET: secret, HIK_REGISTER_GROUP_ID: group } = process.env;
  if (file) {
    try {
      const config = JSON.parse(await readFile(file, 'utf8'));
      if (config.origin !== 'https://41.169.72.97' || !config.key || !config.secret || !config.group ||
          !config.certificate || !config.fingerprint) throw new Error('Invalid pinned HikCentral register configuration');
      return { ...config, send: pinnedRegisterTransport(config) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return { origin, key, secret, group, send: fetch };
}

export function pinnedRegisterTransport({ origin, certificate, fingerprint }) {
  const expected = Buffer.from(fingerprint.replaceAll(':', ''), 'hex');
  const trusted = new X509Certificate(certificate);
  if (!/^[a-f0-9]{64}$/i.test(fingerprint.replaceAll(':', '')) ||
      !timingSafeEqual(expected, Buffer.from(trusted.fingerprint256.replaceAll(':', ''), 'hex'))) {
    throw new Error('Pinned HikCentral certificate fingerprint mismatch');
  }
  return async function send(target, options) {
    const url = new URL(target);
    if (url.origin !== origin || url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Unexpected HikCentral destination');
    }
    return new Promise((resolve, reject) => {
      const outgoing = request(url, {
        method: options.method,
        headers: options.headers,
        signal: options.signal,
        ca: certificate,
        rejectUnauthorized: true,
        agent: false,
        checkServerIdentity(_hostname, peer) {
          const actual = Buffer.from((peer.fingerprint256 ?? '').replaceAll(':', ''), 'hex');
          if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
            return new Error('Unexpected HikCentral peer certificate');
          }
        }
      }, (incoming) => {
        const status = incoming.statusCode;
        if (status >= 300 && status < 400 && options.redirect === 'error') {
          incoming.destroy();
          reject(new Error('Unexpected HikCentral redirect'));
          return;
        }
        const body = options.method === 'HEAD' || [204, 205, 304].includes(status)
          ? null : Readable.toWeb(incoming);
        if (!body) incoming.resume();
        resolve(new Response(body, { status, headers: incoming.headers }));
      });
      outgoing.on('error', reject);
      outgoing.end(options.body);
    });
  };
}
