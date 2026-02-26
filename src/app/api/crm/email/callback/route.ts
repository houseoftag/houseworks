/**
 * GET /api/crm/email/callback
 *
 * Gmail OAuth callback — exchanges code for tokens and saves EmailIntegration.
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
  const stateParam = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code || !stateParam) {
    return NextResponse.redirect(new URL('/settings?tab=integrations&error=email_oauth_failed', req.url));
  }

  let workspaceId: string;
  try {
    const state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
    workspaceId = state.workspaceId;
  } catch {
    return NextResponse.redirect(new URL('/settings?tab=integrations&error=invalid_state', req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/crm/email/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?tab=integrations&error=not_configured', req.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/settings?tab=integrations&error=token_exchange_failed', req.url));
  }

  const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string };

  // Fetch user's Gmail address
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userInfoRes.json() as { email?: string };
  const email = userInfo.email ?? 'unknown';

  await prisma.emailIntegration.upsert({
    where: { workspaceId_email: { workspaceId, email } },
    create: {
      workspaceId,
      provider: 'GMAIL',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      email,
    },
    update: {
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  });

  return NextResponse.redirect(new URL('/settings?tab=integrations&success=email_connected', req.url));
}
