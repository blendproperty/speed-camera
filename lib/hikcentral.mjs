import { createHash, createHmac, randomUUID } from 'node:crypto';

export const recordsPath = '/artemis/api/pms/v1/crossRecords/page';
export const imagePath = '/artemis/api/pms/v1/image';
export const vehicleSearchPath = '/artemis/api/resource/v1/vehicle/advance/vehicleList';
const vehicleDetailPath = '/artemis/api/resource/v1/vehicle/indexCode/vehicleInfo';
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
  async function post(path, input, timeout = 20000) {
    const body = JSON.stringify(input);
    let response;
    try {
      response = await send(url.origin + path, {
        method: 'POST', body, headers: signedHeaders(path, body, key, secret),
        redirect: 'error', signal: AbortSignal.timeout(timeout)
      });
    } catch {
      throw new Error('HikCentral connection or TLS check failed');
    }
    if (!response.ok) throw new Error('HikCentral HTTP ' + response.status);
    return response;
  }
  async function vehicleData(path, input) {
    const response = await post(path, input, 6000);
    const output = JSON.parse((await readBounded(response, 750_000)).toString('utf8'));
    if (String(output?.code) !== '0' || !output.data || typeof output.data !== 'object') {
      throw new Error('HikCentral rejected the vehicle register request');
    }
    return output.data;
  }
  return {
    speedUnit,
    async registeredVehicle(plate, occurredAt, groupCode) {
      if (!canonicalPlate(plate) || !groupCode || groupCode.length > 64) {
        throw new Error('Invalid HikCentral vehicle register query');
      }
      const search = async (value) => {
        const data = await vehicleData(vehicleSearchPath, {
          plateNo: value, vehicleGroupIndexCode: groupCode, pageNo: 1, pageSize
        });
        const list = data.list ?? [];
        if (!Number.isSafeInteger(data.total) || data.total < 0 ||
            !Array.isArray(list) || list.length !== data.total || list.length > pageSize) {
          throw new Error('Incomplete HikCentral vehicle register results');
        }
        return list;
      };
      const matches = await search(plate);
      const key = canonicalPlate(plate);
      const records = matches.some((record) => canonicalPlate(record?.plateNo) === key) || key === plate
        ? matches : await search(key);
      const exact = records.filter((record) => canonicalPlate(record?.plateNo) === key);
      if (!exact.length) return { status: 'none' };
      if (exact.some((record) => !registerDate(record.effectiveDate) || !registerDate(record.expiredDate) ||
          registerDate(record.effectiveDate) > registerDate(record.expiredDate))) return { status: 'undated' };
      const valid = exact.filter((record) => {
        return registerDate(record.effectiveDate) <= occurredAt && occurredAt <= registerDate(record.expiredDate);
      });
      if (!valid.length) return { status: 'outside-period' };
      if (valid.length > 1) return { status: 'ambiguous' };
      const record = valid[0];
      let make = registerMake(record);
      const id = registerText(record.vehicleId, 32);
      if (!make && id) {
        try {
          const detail = await vehicleData(vehicleDetailPath, { vehicleIndexCode: id });
          if (detail.vehicleId === id && canonicalPlate(detail.plateNo) === key) make = registerMake(detail);
        } catch {
          // The filtered list remains usable if the key lacks detail access or the detail service is unavailable.
        }
      }
      return {
        status: 'match',
        owner: registerText(record.personName, 512) ||
          [registerText(record.personGivenName, 256), registerText(record.personFamilyName, 256)].filter(Boolean).join(' ') || null,
        make,
        colour: registerColour(record.vehicleColor)
      };
    },
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

function canonicalPlate(value) {
  if (typeof value !== 'string' || value.length > 64) return '';
  const plate = value.toUpperCase().replace(/[\s.-]/g, '');
  return /^[A-Z0-9]+$/.test(plate) ? plate : '';
}

function registerDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function registerText(value, max) {
  return typeof value === 'string' && value.trim().length <= max ? value.trim() || null : null;
}

function registerMake(record) {
  for (const value of [record.vehicleBrandName, record.vehicleMake, record.vehicleBrand, record.brand]) {
    const make = registerText(value, 100);
    if (make && /\p{L}/u.test(make)) return make;
  }
  return null;
}

function registerColour(value) {
  const colours = ['Other', 'White', 'Silver', 'Grey', 'Black', 'Red', 'Dark blue', 'Blue', 'Yellow',
    'Green', 'Brown', 'Pink', 'Purple', 'Dark blue', 'Cyan'];
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    return colours[Number(value)] ?? null;
  }
  return registerText(value, 32);
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
