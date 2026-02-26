/**
 * GET /api/crm/quickbooks/connect?workspaceId=...
 *
 * Initiates QuickBooks OAuth 2.0 flow.
 * Redirects the user to Intuit's authorization page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  const clientId = process.env.QB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'QB_CLIENT_ID not configured' }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/crm/quickbooks/callback`;
  const state = Buffer.from(JSON.stringify({ workspaceId, userId: session.user.id })).toString('base64');
  const scope = 'com.intuit.quickbooks.accounting';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
  });

  return NextResponse.redirect(`${QB_AUTH_URL}?${params.toString()}`);
}
