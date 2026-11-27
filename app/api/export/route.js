import { currentSession } from '../../../lib/auth.mjs';
import { audit, initialize, transaction } from '../../../lib/db.mjs';
import { csvCell } from '../../../lib/operations.mjs';

export async function GET() {
  const session = await currentSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  await initialize();
  const rows = await transaction(async (client) => {
    const result = await client.query(
      `SELECT c.id,c.provider_id,c.captured_at,c.camera_code,m.name,c.plate,c.speed_kmh,c.limit_kmh,
        c.image_sha256,c.reviewed_by,c.reviewed_at,c.review_note FROM captures c JOIN cameras m ON m.code=c.camera_code
        WHERE c.status='approved' ORDER BY c.captured_at DESC,c.id DESC LIMIT 10001`
    );
    if (result.rowCount > 10000) return null;
    await audit(client, session.username, 'approved_captures_exported', null, { ids: result.rows.map((row) => row.id) });
    return result.rows;
  });
  if (!rows) return new Response('Export exceeds the 10,000-record limit', { status: 422 });
  const header = ['Capture ID','Provider ID','Captured UTC','Camera code','Camera','Registration','Speed km/h',
    'Limit km/h','Evidence SHA-256','Reviewer','Reviewed UTC','Review reason'];
  const data = rows.map((r) => [r.id,r.provider_id,r.captured_at.toISOString(),r.camera_code,r.name,r.plate,
    r.speed_kmh,r.limit_kmh,r.image_sha256,r.reviewed_by,r.reviewed_at.toISOString(),r.review_note]);
  const csv = [header, ...data].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return new Response(csv, { headers: {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="midpoint-reviewed-captures.csv"',
    'cache-control': 'private, no-store'
  } });
}
