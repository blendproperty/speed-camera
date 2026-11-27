import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession } from '../lib/auth.mjs';
import { initialize } from '../lib/db.mjs';

export async function operator() {
  const session = await currentSession();
  if (!session) redirect('/login');
  await initialize();
  return session;
}

export function Shell({ current, session, children }) {
  const pages = [['/', 'Review queue'], ['/tickets', 'Speed tickets'], ['/cameras', 'Cameras'], ['/audit', 'Audit log']];
  return <div className="shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="mark" aria-hidden="true">M</span><span>Midpoint<small>Speed monitoring</small></span></Link>
      <nav aria-label="Main navigation">
        {pages.map(([url, label]) => <Link key={url} href={url} aria-current={current === url ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <form className="account" action="/api/actions/logout" method="post">
        <input type="hidden" name="csrf" value={session.csrf} />
        <span>{session.username}</span><button className="quiet">Sign out</button>
      </form>
    </aside>
    <main>{children}</main>
  </div>;
}
