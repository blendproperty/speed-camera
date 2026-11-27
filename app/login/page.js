import { redirect } from 'next/navigation';
import { currentSession } from '../../lib/auth.mjs';

export default async function Login({ searchParams }) {
  if (await currentSession()) redirect('/');
  const query = await searchParams;
  return <main className="login-area">
    <section className="panel login-card">
      <div className="brand"><span className="mark" aria-hidden="true">M</span><span>Midpoint<small>Speed monitoring</small></span></div>
      <h1>Operator sign in</h1>
      {query.error === '1' && <p className="notice" role="alert">Check your username and password.</p>}
      <form method="post" action="/api/auth" className="stack">
        <label>Username<input name="username" autoComplete="username" required maxLength={64} /></label>
        <label>Password<input type="password" name="password" autoComplete="current-password" required maxLength={128} /></label>
        <button className="primary">Sign in</button>
      </form>
    </section>
  </main>;
}
