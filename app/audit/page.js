import Link from 'next/link';
import { operator, Shell } from '../components.js';
import { database } from '../../lib/db.mjs';
import { formatTime, validId } from '../../lib/operations.mjs';

export default async function Audit({ searchParams }) {
  const session = await operator();
  const { before } = await searchParams;
  const cursor = validId(before) ? before : null;
  const { rows } = await database().query(
    'SELECT id,recorded_at,actor,target,action FROM audit WHERE ($1::bigint IS NULL OR id<$1) ORDER BY id DESC LIMIT 51',
    [cursor]
  );
  return <Shell current="/audit" session={session}>
    <header className="heading"><div><h1>Audit log</h1><p>Camera changes, evidence access, review decisions and exports.</p></div></header>
    <section className="panel">
      {rows.length ? <div className="table-wrap"><table>
        <thead><tr><th>Recorded · SAST</th><th>Operator</th><th>Action</th><th>Reference</th></tr></thead>
        <tbody>{rows.slice(0, 50).map((r) => <tr key={r.id}><td>{formatTime(r.recorded_at)}</td>
          <td>{r.actor}</td><td className="audit-action">{r.action.replaceAll('_', ' ')}</td><td>{r.target ?? '–'}</td></tr>)}</tbody>
      </table></div> : <div className="empty"><h2>No recorded activity</h2></div>}
      {(cursor || rows.length > 50) && <nav className="pages" aria-label="Audit pages">
        {cursor && <Link href="/audit">Latest activity</Link>}
        {rows.length > 50 && <Link href={'/audit?before=' + rows[49].id}>Older activity</Link>}
      </nav>}
    </section>
  </Shell>;
}
