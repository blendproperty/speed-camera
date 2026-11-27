import { NextResponse } from 'next/server';
import { authenticate, issueSession, readForm, sameOrigin, sessionDuration, sessionName, validUsername } from '../../../lib/auth.mjs';

export async function POST(request) {
  if (!sameOrigin(request)) return new Response('Invalid origin', { status: 403 });
  const input = await readForm(request);
  if (!input) return new Response('Invalid form', { status: 400 });
  const username = String(input.get('username') ?? '').trim().toLowerCase();
  const password = input.get('password');
  const credential = validUsername(username) && typeof password === 'string' && password.length <= 128
    ? await authenticate(username, password) : null;
  const response = NextResponse.redirect(new URL(credential ? '/' : '/login?error=1', process.env.PUBLIC_ORIGIN), 303);
  if (credential) response.cookies.set(sessionName, issueSession(username, credential), {
    httpOnly: true, secure: new URL(process.env.PUBLIC_ORIGIN).protocol === 'https:',
    sameSite: 'strict', path: '/', maxAge: sessionDuration
  });
  return response;
}
