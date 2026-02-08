import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/require-user';
import crypto from 'crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
].join(' ');

export async function GET() {
  const user = await requireUser();

  const state = Buffer.from(
    JSON.stringify({ userId: user.id, nonce: crypto.randomBytes(16).toString('hex') })
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_FIT_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_FIT_REDIRECT_URI!,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
