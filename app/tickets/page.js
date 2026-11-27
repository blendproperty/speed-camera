import Link from 'next/link';
import { operator, Shell } from '../components.js';
import { database } from '../../lib/db.mjs';
import { formatTime, validId } from '../../lib/operations.mjs';
import { ticketReference, ticketStatuses } from '../../lib/tickets.mjs';

export default async function Tickets({ searchParams }) {
  const session = await operator();
  const query = await searchParams;
  const status = typeof query.status === 'string' && Object.hasOwn(ticketStatuses, query.status) ? query.status : '';
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, 64) : '';
  const before = validId(query.before) ? query.before : null;
  const { rows } = await database().query(
    `SELECT t.id,t.status,t.camera_name,t.created_at,c.plate,c.speed_kmh,c.limit_kmh
     FROM speed_tickets t JOIN captures c ON c.id=t.capture_id
     WHERE ($1='' OR t.status=$1) AND ($2::bigint IS NULL OR t.id<$2)
       AND ($3='' OR position(upper($3) in upper(c.plate))>0 OR
          upper($3) IN ('MP-S-' || lpad(t.id::text,greatest(6,length(t.id::text)),'0'),t.id::text))
     ORDER BY t.id DESC LIMIT 51`, [status, before, search]
  );
  return <Shell current="/tickets" session={session}>
    <header className="heading"><div><h1>Speed tickets</h1><p>Prepare and track notices from approved camera captures.</p></div>
      <Link className="button secondary" href="/?status=approved">Approved captures</Link></header>
    <section className="panel">
      <form className="filters" action="/tickets" method="get">
        <label>Status<select name="status" defaultValue={status}><option value="">All tickets</option>
          {Object.entries(ticketStatuses).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select></label>
        <label>Reference or registration<input name="q" defaultValue={search} maxLength={64} /></label>
        <button className="primary">Filter</button>
      </form>
      {rows.length ? <div className="table-wrap"><table>
        <thead><tr><th>Reference</th><th>Created · SAST</th><th>Camera</th><th>Registration</th><th>Speed / limit</th><th>Status</th></tr></thead>
        <tbody>{rows.slice(0, 50).map((t) => <tr key={t.id}>
          <td><Link href={'/tickets/' + t.id}>{ticketReference(t.id)}</Link></td><td>{formatTime(t.created_at)}</td>
          <td>{t.camera_name}</td><td>{t.plate}</td><td>{t.speed_kmh} / {t.limit_kmh} km/h</td>
          <td><span className={'status ' + t.status}>{ticketStatuses[t.status]}</span></td>
        </tr>)}</tbody>
      </table></div> : <div className="empty"><h2>No tickets match</h2><p>Create a ticket from an approved capture.</p></div>}
      {(before || rows.length > 50) && <nav className="pages" aria-label="Ticket pages">
        {before && <Link href={'/tickets?' + new URLSearchParams({ status, q: search })}>Latest tickets</Link>}
        {rows.length > 50 && <Link href={'/tickets?' + new URLSearchParams({ status, q: search, before: rows[49].id })}>Older tickets</Link>}
      </nav>}
    </section>
  </Shell>;
}
