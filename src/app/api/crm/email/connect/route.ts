/**
 * GET /api/crm/email/connect?workspaceId=...
 *
 * Initiates Gmail OAuth 2.0 flow.
 * Redirects the user to Google's authorization page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/crm/email/callback`;
  const state = Buffer.from(JSON.stringify({ workspaceId, userId: session.user.id })).toString('base64');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
