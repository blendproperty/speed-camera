import { database, initialize } from '../../../lib/db.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initialize();
    await database().query('SELECT 1');
    return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
