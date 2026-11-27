import { createHash, createHmac, randomUUID } from 'node:crypto';

export const recordsPath = '/artemis/api/pms/v1/crossRecords/page';
export const imagePath = '/artemis/api/pms/v1/image';
export const pageSize = 100;

export function signedHeaders(path, body, key, secret, timestamp = Date.now(), nonce = randomUUID()) {
  const headers = {
    accept: '*/*',
    'content-type': 'application/json; charset=utf-8',
    'content-md5': createHash('md5').update(body).digest('base64'),
    'x-ca-key': key,
    'x-ca-nonce': nonce,
    'x-ca-timestamp': String(timestamp)
  };
  const names = ['x-ca-key', 'x-ca-nonce', 'x-ca-timestamp'];
  const canonical = ['POST', headers.accept, headers['content-md5'], headers['content-type'],
    ...names.map((name) => name + ':' + headers[name]), path].join('\n');
  headers['x-ca-signature-headers'] = names.join(',');
  headers['x-ca-signature'] = createHmac('sha256', secret).update(canonical).digest('base64');
  return headers;
}

export function hikcentral({ origin, key, secret, speedUnit, send = fetch }) {
  if (!origin || !key || !secret) throw new Error('HikCentral credentials are incomplete');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid HikCentral HTTPS origin');
  async function post(path, input) {
    const body = JSON.stringify(input);
    let response;
    try {
      response = await send(url.origin + path, {
        method: 'POST', body, headers: signedHeaders(path, body, key, secret),
        redirect: 'error', signal: AbortSignal.timeout(20000)
      });
    } catch {
      throw new Error('HikCentral connection or TLS check failed');
    }
    if (!response.ok) throw new Error('HikCentral HTTP ' + response.status);
    return response;
  }
  return {
    speedUnit,
    async records(cameraCode, from, to, pageNo) {
      const response = await post(recordsPath, {
        cameraIndexCode: cameraCode, startTime: from.toISOString(), endTime: to.toISOString(),
        pageNo, pageSize, sortField: 'PassTime', orderType: 1
      });
      const output = JSON.parse((await readBounded(response, 2_000_000)).toString('utf8'));
      if (String(output.code) !== '0') {
        const code = String(output.code ?? '');
        throw new Error('HikCentral rejected the records request' + (/^[\w-]{1,30}$/.test(code) ? ' (' + code + ')' : ''));
      }
      const result = output.data;
      if (!Number.isSafeInteger(result?.total) || result.total < 0 ||
          !(Array.isArray(result.list) || (result.total === 0 && result.list == null)) ||
          (result.list?.length ?? 0) > pageSize) throw new Error('Unexpected HikCentral records response');
      return { total: result.total, records: result.list ?? [] };
    },
    async image(reference) {
      const response = await post(imagePath, { picUri: reference });
      const bytes = await readBounded(response, 5_000_000);
      if (response.headers.get('content-type')?.split(';')[0] === 'image/jpeg' &&
          bytes.length > 4 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) &&
          bytes.subarray(-2).equals(Buffer.from([255, 217]))) {
        return { bytes, type: 'image/jpeg', hash: createHash('sha256').update(bytes).digest('hex') };
      }
      throw new Error('HikCentral did not return a valid JPEG');
    }
  };
}

async function readBounded(response, maximum) {
  if (!response.body) return Buffer.alloc(0);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > maximum) throw new Error('HikCentral response exceeds size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

export function normalize(record, cameraCode, speedUnit) {
  if (String(record?.cameraIndexCode) !== cameraCode) throw new Error('HikCentral returned another camera');
  const date = record.crossTime;
  const captured = new Date(date);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(date) ||
      !Number.isFinite(captured.valueOf())) throw new Error('HikCentral record is missing a valid capture time');
  const plate = typeof record.plateNo === 'string' && record.plateNo.length <= 64 ? record.plateNo.trim() || null : null;
  const pic = typeof record.vehiclePicUri === 'string' && record.vehiclePicUri.length <= 256
    ? record.vehiclePicUri.trim() || null : null;
  const measured = record.vehicleSpeed;
  const converted = speedUnit === 'kmh' ? measured : speedUnit === 'mph' ? measured * 1.609344 : null;
  const speed = typeof measured === 'number' && typeof converted === 'number' &&
    Number.isFinite(converted) && converted > 0 && converted <= 350 ? Math.round(converted * 10) / 10 : null;
  const id = record.crossRecordSyscode;
  if (typeof id !== 'string' || !id.trim() || id.length > 64) throw new Error('HikCentral record is missing its capture ID');
  return { id, captured, plate, pic, speed };
}
