import { NextResponse } from 'next/server';
import { currentSession, readForm, sameOrigin, sessionName } from '../../../../lib/auth.mjs';
import { initialize } from '../../../../lib/db.mjs';
import { InputError, reviewCapture, saveCamera } from '../../../../lib/operations.mjs';
import { createTicket, updateTicket } from '../../../../lib/tickets.mjs';

export async function POST(request, { params }) {
  const { action } = await params;
  if (!sameOrigin(request)) return new Response('Forbidden', { status: 403 });
  const session = await currentSession();
  if (!session) return new Response('Forbidden', { status: 403 });
  const form = await readForm(request);
  if (!form) return new Response('Invalid form', { status: 400 });
  if (form.get('csrf') !== session.csrf) return new Response('Forbidden', { status: 403 });
  if (action === 'logout') {
    const response = NextResponse.redirect(new URL('/login', process.env.PUBLIC_ORIGIN), 303);
    response.cookies.delete(sessionName);
    return response;
  }
  if (!['camera', 'review', 'ticket-create', 'ticket-update'].includes(action)) return new Response('Not found', { status: 404 });
  await initialize();
  try {
    if (action === 'camera') await saveCamera(form, session.username);
    else if (action === 'review') await reviewCapture(form.get('id'), form, session.username);
    else {
      const id = action === 'ticket-create'
        ? await createTicket(form.get('id'), session.username)
        : await updateTicket(form.get('id'), form, session.username);
      return NextResponse.redirect(new URL('/tickets/' + id, process.env.PUBLIC_ORIGIN), 303);
    }
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    return new Response(error.message, { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return NextResponse.redirect(new URL(action === 'camera' ? '/cameras?saved=1' : '/?saved=1', process.env.PUBLIC_ORIGIN), 303);
}
