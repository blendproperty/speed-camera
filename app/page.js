import Link from 'next/link';
import { database } from '../lib/db.mjs';
import { formatTime, statuses } from '../lib/operations.mjs';
import { operator, Shell } from './components.js';

const defaultView = 'review';
const pageSize = 25;

export default async function Dashboard({ searchParams }) {
  const session = await operator();
  const q = await searchParams;
  const status = typeof q.status === 'string' && (q.status === 'all' || Object.hasOwn(statuses, q.status)) ? q.status : defaultView;
  const plate = typeof q.plate === 'string' ? q.plate.trim().slice(0, 64) : '';
  const camera = typeof q.camera === 'string' ? q.camera.slice(0, 64) : '';
  const page = typeof q.page === 'string' && /^[1-9]\d{0,3}$/.test(q.page) ? Number(q.page) : 1;
  const [cameraRows, counts, captures] = await Promise.all([
    database().query('SELECT code,name FROM cameras ORDER BY name'),
    database().query(`SELECT status,count(*)::int AS count FROM captures
      WHERE status IN ('pending','held','approved','unmeasured') GROUP BY status`),
    database().query(`SELECT c.id,c.captured_at,c.plate,c.speed_kmh,c.limit_kmh,c.status,
        c.image_sha256,c.reviewed_by,c.review_note,m.name
        FROM captures c JOIN cameras m ON m.code=c.camera_code
        WHERE ($1='all' OR ($1='review' AND c.status IN ('pending','held')) OR c.status=$1)
          AND ($2='' OR position(upper($2) in upper(c.plate))>0)
          AND ($3='' OR c.camera_code=$3)
        ORDER BY c.captured_at DESC,c.id DESC LIMIT $4 OFFSET $5`,
    [status, plate, camera, pageSize + 1, (page - 1) * pageSize])
  ]);
  const tally = Object.fromEntries(counts.rows.map(({ status, count }) => [status, count]));
  const rows = captures.rows.slice(0, pageSize);
  const nextLink = (number) => '/?' + new URLSearchParams({ plate, camera, status, page: String(number) });
  return <Shell current="/" session={session}>
    <header className="heading">
      <div><h1>Capture review</h1><p>Review speed measurements and their supporting evidence.</p></div>
      <a className="button secondary" href="/api/export">Export approved CSV</a>
    </header>
    {q.saved === '1' && <p className="notice" role="status">Review decision saved.</p>}
    {process.env.HIK_SYNC_ENABLED !== 'true' && <p className="notice" role="status">HikCentral polling is off. Connect the provider to receive camera captures.</p>}
    <div className="metrics">
      {['pending','held','approved','unmeasured'].map((key) => <Link className="metric" key={key} href={'/?status=' + key}>
        <span>{statuses[key]}</span><strong>{tally[key] ?? 0}</strong>
      </Link>)}
    </div>
    <section className="panel">
      <form className="filters" action="/" method="get">
        <label>Status<select name="status" defaultValue={status}>
          <option value="review">Open review queue</option><option value="all">All captures</option>
          {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Camera<select name="camera" defaultValue={camera}>
          <option value="">All cameras</option>
          {cameraRows.rows.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select></label>
        <label>Registration<input name="plate" placeholder="Search registration" defaultValue={plate} maxLength={64} /></label>
        <button className="primary">Filter</button>
      </form>
      {rows.length ? <div className="table-wrap"><table>
        <thead><tr><th>Captured · SAST</th><th>Camera</th><th>Registration</th><th>Speed / limit</th><th>Status</th><th>Evidence and review</th></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.id}>
          <td>{formatTime(c.captured_at)}</td><td>{c.name}</td><td><strong>{c.plate ?? '–'}</strong></td>
          <td>{c.speed_kmh ?? '–'} / {c.limit_kmh} km/h</td>
          <td><span className={'status ' + c.status}>{statuses[c.status]}</span></td>
          <td>
            {c.image_sha256 && <a href={'/api/evidence/' + c.id} target="_blank" rel="noreferrer">Open photo</a>}
            {['held', 'pending'].includes(c.status) && <details>
              <summary>Review capture</summary>
              <form className="stack review" action="/api/actions/review" method="post">
                <input type="hidden" name="csrf" value={session.csrf} />
                <input type="hidden" name="id" value={c.id} />
                <label>Decision<select name="decision" defaultValue="" required>
                  <option value="" disabled>Choose decision</option>
                  {c.status === 'pending' && <option value="approved">Approve internally</option>}
                  <option value="dismissed">Dismiss</option>
                </select></label>
                <label>Reason<textarea name="note" maxLength={500} required rows={2} /></label>
                <button className="primary">Save review</button>
              </form>
            </details>}
            {c.reviewed_by && <small className="review-note">{c.reviewed_by} · {c.review_note}</small>}
          </td>
        </tr>)}</tbody>
      </table></div> : <div className="empty"><h2>No captures match</h2><p>{cameraRows.rowCount ? 'Change the filters or check the camera sync status.' : 'Add a camera to begin configuring the feed.'}</p><Link href="/cameras">View cameras</Link></div>}
      {(page > 1 || captures.rows.length > pageSize) && <nav className="pages" aria-label="Results pages">
        {page > 1 && <Link href={nextLink(page - 1)}>Previous</Link>}<span>Page {page}</span>
        {captures.rows.length > pageSize && page < 9999 && <Link href={nextLink(page + 1)}>Next</Link>}
      </nav>}
    </section>
  </Shell>;
}
