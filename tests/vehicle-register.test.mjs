import assert from 'node:assert/strict';
import test from 'node:test';
import { hikcentral, vehicleSearchPath } from '../lib/hikcentral.mjs';

const captured = new Date('2026-11-27T07:00:00Z');
const record = {
  vehicleId: 'test-vehicle', plateNo: 'ZZ 123-GP', personName: 'Example Operator',
  effectiveDate: '2026-11-01T00:00:00+02:00', expiredDate: '2027-11-01T00:00:00+02:00',
  vehicleColor: 3, phoneNo: 'fixture-private', personId: 'fixture-private'
};

function register(records, detail, total = records.length) {
  return hikcentral({
    origin: 'https://example.test', key: 'fixture-key', secret: 'fixture-secret',
    send: async (url, options) => {
      assert.ok(options.headers['x-ca-signature']);
      assert.equal(options.redirect, 'error');
      const body = JSON.parse(options.body);
      if (url.endsWith(vehicleSearchPath)) {
        assert.equal(body.vehicleGroupIndexCode, 'fixture-group');
        assert.ok(body.plateNo);
        return Response.json({ code: '0', data: { list: records, total } });
      }
      assert.ok(url.endsWith('/vehicle/indexCode/vehicleInfo'));
      assert.equal(body.vehicleIndexCode, record.vehicleId);
      return Response.json({ code: '0', data: detail ?? record });
    }
  });
}

test('returns owner, registered make and colour from an exact effective plate match', async () => {
  const service = register([{ ...record, plateNo: 'OTHERZZ123GP' }, record], { ...record, vehicleBrandName: 'Example Make' });
  const result = await service.registeredVehicle('zz123 gp', captured, 'fixture-group');
  assert.deepEqual(result, { status: 'match', owner: 'Example Operator', make: 'Example Make', colour: 'Grey' });
});

test('refuses fuzzy, expired, undated, ambiguous and incomplete results', async () => {
  const find = (service) => service.registeredVehicle('ZZ123GP', captured, 'fixture-group');
  assert.deepEqual(await find(register([{ ...record, plateNo: 'OTHERZZ123GP' }])), { status: 'none' });
  assert.deepEqual(await find(register([{ ...record, expiredDate: '2026-11-15T08:00:00+02:00' }])), { status: 'outside-period' });
  assert.deepEqual(await find(register([{ ...record, effectiveDate: '2026-11-01' }])), { status: 'undated' });
  assert.deepEqual(await find(register([record, { ...record, vehicleId: 'second' }])), { status: 'ambiguous' });
  await assert.rejects(find(register([record], null, 101)), /Incomplete/);
});

test('does not substitute a make from mismatched detail or an undocumented code', async () => {
  const result = await register([{ ...record, vehicleBrand: 25 }], { ...record, plateNo: 'OTHER', brand: 'Other make' })
    .registeredVehicle('ZZ123GP', captured, 'fixture-group');
  assert.equal(result.status, 'match');
  assert.equal(result.make, null);
});
