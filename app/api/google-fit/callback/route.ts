import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma/client';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const baseUrl = req.nextUrl.origin;

  // User denied consent
  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/?error=consent_denied`);
  }

  // Decode state to get userId
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    userId = decoded.userId;
    if (!userId) throw new Error('Missing userId in state');
  } catch (err) {
    console.error('Google Fit state decode error:', err);
    return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
  }

  // Exchange authorization code for tokens
  let tokenData: Record<string, unknown>;
  try {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_FIT_CLIENT_ID!,
        client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_FIT_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });

    const body = await resp.text();

    if (!resp.ok) {
      console.error('Google token exchange failed:', resp.status, body);
      return NextResponse.redirect(
        `${baseUrl}/?error=token_exchange_failed`
      );
    }

    tokenData = JSON.parse(body);
  } catch (err) {
    console.error('Google Fit token fetch error:', err);
    return NextResponse.redirect(`${baseUrl}/?error=token_fetch_error`);
  }

  // Persist tokens
  try {
    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in as number) * 1000
    );

    // Delete-then-create instead of upsert to avoid PgBouncer transaction issues
    await prisma.googleFitConnection.deleteMany({ where: { userId } });
    await prisma.googleFitConnection.create({
      data: {
        userId,
        accessToken: tokenData.access_token as string,
        refreshToken: tokenData.refresh_token as string,
        expiresAt,
        scopes: (tokenData.scope as string) ?? '',
      },
    });

    return NextResponse.redirect(`${baseUrl}/?connected=true`);
  } catch (err) {
    console.error('Google Fit DB save error:', err);
    return NextResponse.redirect(`${baseUrl}/?error=db_save_failed`);
  }
}
