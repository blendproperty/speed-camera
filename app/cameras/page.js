import { operator, Shell } from '../components.js';
import { database } from '../../lib/db.mjs';
import { formatTime } from '../../lib/operations.mjs';

function CameraForm({ session, camera }) {
  return <form className="filters camera-form" action="/api/actions/camera" method="post">
    <input type="hidden" name="csrf" value={session.csrf} />
    <label>HikCentral camera ID<input name="code" defaultValue={camera?.code} readOnly={!!camera} maxLength={64} required /></label>
    <label>Camera name<input name="name" defaultValue={camera?.name} maxLength={100} required /></label>
    <label>Limit (km/h)<input name="limit" type="number" step="0.1" min="0.1" max="160" defaultValue={camera?.limit_kmh} required /></label>
    <label className="check"><input name="enabled" type="checkbox" defaultChecked={camera?.enabled ?? true} /> Poll camera</label>
    <button className="primary">{camera ? 'Save camera' : 'Add camera'}</button>
  </form>;
}

export default async function Cameras({ searchParams }) {
  const session = await operator();
  const [result, query] = await Promise.all([database().query('SELECT * FROM cameras ORDER BY name'), searchParams]);
  return <Shell current="/cameras" session={session}>
    <header className="heading"><div><h1>Cameras</h1><p>Configure monitored camera IDs and check their latest capture and sync.</p></div></header>
    {query.saved === '1' && <p className="notice" role="status">Camera saved.</p>}
    {process.env.HIK_SYNC_ENABLED !== 'true' && <p className="notice" role="status">HikCentral polling is off.</p>}
    <section className="panel section"><h2>Add camera</h2><CameraForm session={session} /></section>
    {result.rows.length ? result.rows.map((camera) => <section className="panel section" key={camera.code}>
      <h2>{camera.name}</h2>
      <dl className="camera-status">
        <div><dt>Polling</dt><dd>{camera.enabled ? 'Enabled' : 'Paused'}</dd></div>
        <div><dt>Last successful sync · SAST</dt><dd>{formatTime(camera.last_poll_at)}</dd></div>
        <div><dt>Latest capture · SAST</dt><dd>{formatTime(camera.last_capture_at)}</dd></div>
      </dl>
      {camera.poll_error && <p className="notice" role="status">{camera.poll_error}</p>}
      <details><summary>Edit camera</summary><CameraForm session={session} camera={camera} /></details>
    </section>) : <div className="panel empty"><h2>No cameras configured</h2><p>Add the HikCentral ID and posted speed limit for each camera.</p></div>}
  </Shell>;
}
