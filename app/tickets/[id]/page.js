import Link from 'next/link';
import { notFound } from 'next/navigation';
import { operator, Shell } from '../../components.js';
import { database } from '../../../lib/db.mjs';
import { formatTime, validId } from '../../../lib/operations.mjs';
import { ticketReference, ticketStatuses } from '../../../lib/tickets.mjs';
import PrintButton from './print-button.js';

export default async function Ticket({ params }) {
  const session = await operator();
  const { id } = await params;
  if (!validId(id)) notFound();
  const { rows: [t] } = await database().query(
    `SELECT t.*,c.captured_at,c.plate,c.speed_kmh,c.limit_kmh,c.camera_code,c.image_sha256,
       c.reviewed_by,c.reviewed_at FROM speed_tickets t JOIN captures c ON c.id=t.capture_id WHERE t.id=$1`, [id]
  );
  if (!t) notFound();
  const reference = ticketReference(id);
  const above = (Number(t.speed_kmh) - Number(t.limit_kmh)).toFixed(1);
  const evidence = '/api/evidence/' + t.capture_id;
  return <Shell current="/tickets" session={session}>
    <div className="heading no-print"><Link href="/tickets">Back to speed tickets</Link><PrintButton /></div>
    <article className="notice-sheet" aria-labelledby="notice-title">
      <header className="notice-header">
        <div><p className="notice-issuer">MIDPOINT · SITE MANAGEMENT</p><h1 id="notice-title">Site speeding notice</h1></div>
        <div className="notice-ref"><span>Notice reference</span><strong>{reference}</strong><span className={'status ' + t.status}>{ticketStatuses[t.status]}</span></div>
      </header>
      {t.status === 'draft' && <p className="notice-banner">Draft · For internal review</p>}
      {t.status === 'void' && <p className="notice-banner">Voided · {t.void_reason}</p>}
      <section className="notice-block">
        <h2>Recipient and incident</h2>
        <dl className="notice-grid">
          <div><dt>Recipient</dt><dd>{t.recipient || 'Pending verification'}</dd></div>
          <div><dt>Vehicle registration</dt><dd className="notice-plate">{t.plate}</dd></div>
          <div><dt>Capture date and time · SAST</dt><dd>{formatTime(t.captured_at)}</dd></div>
          <div><dt>Camera / location</dt><dd>{t.camera_name} · {t.camera_code}</dd></div>
          <div><dt>Site rule reference</dt><dd>{t.rule_reference || 'Pending verification'}</dd></div>
          <div><dt>Notice prepared · SAST</dt><dd>{formatTime(t.created_at)}</dd></div>
        </dl>
      </section>
      <section className="notice-block">
        <h2>Speed measurement</h2>
        <dl className="notice-grid measurements">
          <div><dt>Measured speed</dt><dd>{t.speed_kmh} km/h</dd></div>
          <div><dt>Posted limit</dt><dd>{t.limit_kmh} km/h</dd></div>
          <div><dt>Above limit</dt><dd>{above} km/h</dd></div>
        </dl>
      </section>
      <section className="notice-block">
        <h2>Camera evidence</h2>
        <figure className="notice-photo">
          <img src={evidence} alt={'Camera capture associated with registration ' + t.plate} />
          <figcaption>Capture {t.capture_id} · SHA-256 {t.image_sha256}</figcaption>
        </figure>
      </section>
      <footer className="notice-footer">
        {t.notice_note && <p className="notice-copy">{t.notice_note}</p>}
        <p>Quote <strong>{reference}</strong> when contacting Midpoint Site Management about this notice.</p>
        {t.finalized_at && <p>Finalized by {t.finalized_by} on {formatTime(t.finalized_at)} SAST.</p>}
      </footer>
    </article>
    <section className="panel section no-print">
      <h2>Ticket details</h2>
      <p>Created by {t.created_by}. Capture reviewed by {t.reviewed_by} on {formatTime(t.reviewed_at)} SAST.</p>
      {t.status === 'draft' && <form className="stack ticket-editor" action="/api/actions/ticket-update" method="post">
        <input type="hidden" name="csrf" value={session.csrf} /><input type="hidden" name="id" value={id} />
        <label>Verified recipient<input name="recipient" defaultValue={t.recipient} maxLength={120} /></label>
        <label>Site rule reference<input name="rule" defaultValue={t.rule_reference} maxLength={120} /></label>
        <label>Notice message<textarea name="noticeNote" defaultValue={t.notice_note} maxLength={350} rows={3} /></label>
        <label className="check"><input name="verified" type="checkbox" /> I checked the recipient, applicable rule and camera evidence.</label>
        <div className="ticket-buttons">
          <button className="secondary" name="operation" value="save">Save draft</button>
          <button className="primary" name="operation" value="finalize">Finalize notice</button>
        </div>
      </form>}
      {t.status !== 'void' && <details><summary>Void notice</summary>
        <form className="stack ticket-editor" action="/api/actions/ticket-update" method="post">
          <input type="hidden" name="csrf" value={session.csrf} /><input type="hidden" name="id" value={id} />
          <label>Void reason<textarea name="reason" required maxLength={300} rows={2} /></label>
          <button className="secondary" name="operation" value="void">Void this notice</button>
        </form>
      </details>}
    </section>
  </Shell>;
}
