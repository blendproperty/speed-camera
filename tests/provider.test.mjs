import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { hikcentral, imagePath, normalize, recordsPath, signedHeaders } from '../lib/hikcentral.mjs';
import { captureStatus, pollCamera } from '../lib/ingest.mjs';
import { csvCell, validId } from '../lib/operations.mjs';

const fixture = {
  crossRecordSyscode: 'synthetic-1', crossTime: '2026-11-27T09:00:00+02:00',
  cameraIndexCode: 'fixture-camera', plateNo: 'TEST 01', vehicleSpeed: 46, vehiclePicUri: '/fixture/jpeg'
};

test('Artemis signing and passing-record response contract', async () => {
  const body = '{"cameraIndexCode":"fixture-camera"}';
  const digest = createHash('md5').update(body).digest('base64');
  const canonical = `POST\n*/*\n${digest}\napplication/json; charset=utf-8\nx-ca-key:key\nx-ca-nonce:nonce\nx-ca-timestamp:123\n${recordsPath}`;
  const headers = signedHeaders(recordsPath, body, 'key', 'secret', 123, 'nonce');
  assert.equal(headers['x-ca-signature'], createHmac('sha256', 'secret').update(canonical).digest('base64'));
  const provider = hikcentral({ origin: 'https://example.test', key: 'key', secret: 'secret',
    send: async (url, options) => {
      assert.equal(url, 'https://example.test' + recordsPath);
      assert.equal(options.redirect, 'error');
      assert.equal(JSON.parse(options.body).cameraIndexCode, fixture.cameraIndexCode);
      return Response.json({ code: '0', data: { total: 1, list: [fixture] } });
    }
  });
  const result = await provider.records(fixture.cameraIndexCode, new Date(0), new Date(), 1);
  assert.equal(result.records[0].crossRecordSyscode, 'synthetic-1');
  assert.equal(normalize(fixture, fixture.cameraIndexCode, 'kmh').speed, 46);
  assert.equal(normalize(fixture, fixture.cameraIndexCode, 'mph').speed, 74);
  assert.equal(normalize(fixture, fixture.cameraIndexCode).speed, null);
  assert.equal(normalize({ ...fixture, vehicleSpeed: 0 }, fixture.cameraIndexCode, 'kmh').speed, null);
  assert.throws(() => normalize(fixture, 'unrelated-camera', 'kmh'), /another camera/);
});

test('evidence is fetched through the fixed gateway route and hashed', async () => {
  const bytes = Buffer.from([255, 216, 255, 123, 255, 217]);
  const provider = hikcentral({ origin: 'https://example.test', key: 'key', secret: 'secret',
    send: async (url, options) => {
      assert.equal(url, 'https://example.test' + imagePath);
      assert.equal(JSON.parse(options.body).picUri, fixture.vehiclePicUri);
      return new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
    }
  });
  const evidence = await provider.image(fixture.vehiclePicUri);
  assert.equal(evidence.hash, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(captureStatus(46, 30, 'TEST 01', evidence), 'pending');
  assert.equal(captureStatus(46, 30, 'TEST 01'), 'held');
  assert.equal(captureStatus(null, 30, 'TEST 01', evidence), 'unmeasured');
  assert.equal(captureStatus(30, 30, 'TEST 01', evidence), 'within_limit');
});

test('an incomplete page cannot advance the polling cursor', async () => {
  const client = { query: async () => assert.fail('incomplete page must not make a write') };
  const provider = { records: async () => ({ total: 2, records: [fixture] }) };
  await assert.rejects(pollCamera(client, provider, { code: fixture.cameraIndexCode }), /Incomplete/);
});

test('unsafe spreadsheet input is neutralized and invalid record IDs are refused', () => {
  assert.equal(csvCell(' =1+1'), '"\' =1+1"');
  assert.equal(csvCell('TEST "1"'), '"TEST ""1"""');
  assert.equal(validId('9223372036854775808'), false);
  assert.equal(validId('999'), true);
});
