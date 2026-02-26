/**
 * GET /api/crm/quickbooks/callback
 *
 * QuickBooks OAuth callback — exchanges code for tokens and saves integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { auth } from '@/server/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  const code = req.nextUrl.searchParams.get('code');
  const realmId = req.nextUrl.searchParams.get('realmId');
  const stateParam = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code || !realmId || !stateParam) {
    return NextResponse.redirect(new URL('/settings?tab=integrations&error=qb_oauth_failed', req.url));
  }

  let workspaceId: string;
  try {
    const state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
    workspaceId = state.workspaceId;
  } catch {
    return NextResponse.redirect(new URL('/settings?tab=integrations&error=invalid_state', req.url));
  }

  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/crm/quickbooks/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?tab=integrations&error=not_configured', req.url));
  }

  // Exchange code for tokens
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/settings?tab=integrations&error=token_exchange_failed', req.url));
  }

  const tokens = await tokenRes.json() as { access_token: string; refresh_token: string };

  await prisma.quickBooksIntegration.upsert({
    where: { workspaceId },
    create: { workspaceId, realmId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token },
    update: { realmId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token },
  });

  return NextResponse.redirect(new URL('/settings?tab=integrations&success=qb_connected', req.url));
}
