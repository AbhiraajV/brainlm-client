import { prisma } from '@/server/prisma/client';

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export async function getValidToken(userId: string): Promise<{ accessToken: string } | null> {
  const connection = await prisma.googleFitConnection.findUnique({
    where: { userId },
  });

  if (!connection) return null;

  const now = Date.now();
  const expiresAt = connection.expiresAt.getTime();

  // Token is still valid
  if (expiresAt - now > TOKEN_EXPIRY_BUFFER_MS) {
    return { accessToken: connection.accessToken };
  }

  // Token expired or about to expire — refresh it
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_FIT_CLIENT_ID!,
        client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET!,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!resp.ok) {
      // Refresh failed (user likely revoked access) — clean up
      console.error('Google Fit token refresh failed:', resp.status, await resp.text());
      await prisma.googleFitConnection.delete({ where: { userId } });
      return null;
    }

    const data = await resp.json();
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    await prisma.googleFitConnection.update({
      where: { userId },
      data: {
        accessToken: data.access_token,
        expiresAt: newExpiresAt,
      },
    });

    return { accessToken: data.access_token };
  } catch (err) {
    console.error('Google Fit token refresh error:', err);
    await prisma.googleFitConnection.delete({ where: { userId } });
    return null;
  }
}
