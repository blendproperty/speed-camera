import { currentSession } from '../../../../lib/auth.mjs';
import { audit, initialize, transaction } from '../../../../lib/db.mjs';
import { validId } from '../../../../lib/operations.mjs';

export async function GET(request, { params }) {
  const session = await currentSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  if (!validId(id)) return new Response('Not found', { status: 404 });
  await initialize();
  const result = await transaction(async (client) => {
    const row = (await client.query(
      'SELECT image_bytes,image_type,image_sha256 FROM captures WHERE id=$1 AND image_bytes IS NOT NULL', [id]
    )).rows[0];
    if (row) await audit(client, session.username, 'evidence_viewed', id);
    return row;
  });
  if (!result) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(result.image_bytes), { headers: {
    'content-type': result.image_type,
    'content-disposition': 'inline; filename="capture-' + id + '.jpg"',
    'cache-control': 'private, no-store',
    'etag': '"' + result.image_sha256 + '"',
    'x-content-type-options': 'nosniff'
  } });
}
