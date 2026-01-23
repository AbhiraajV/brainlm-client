import { cookies } from 'next/headers'
import { AuthAdapter, AuthUser } from "./types";
import { MockAuthAdapter } from "./mock.adapter";

// Cookie configuration
const SESSION_COOKIE_NAME = 'brainlm-session'
const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
}

// In the future, we can switch based on env (e.g., if (process.env.AUTH_PROVIDER === 'supabase') ...)
// For now, we default to the mock adapter for the foundation.

let adapterInstance: AuthAdapter | null = null;

export function getAuthAdapter(): AuthAdapter {
    if (!adapterInstance) {
        // Factory logic here
        adapterInstance = new MockAuthAdapter();
    }
    return adapterInstance;
}

/**
 * Set the session cookie with user data.
 * Call this on login to establish the session.
 */
export async function setSessionCookie(user: AuthUser, hasBaseline: boolean = false): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(
        SESSION_COOKIE_NAME,
        JSON.stringify({ userId: user.id, email: user.email, hasBaseline }),
        SESSION_COOKIE_OPTIONS
    )
}

/**
 * Update the session cookie to mark baseline as complete.
 * Call this after onboarding completes.
 */
export async function markBaselineComplete(): Promise<void> {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) return

    try {
        const session = JSON.parse(sessionCookie)
        session.hasBaseline = true
        cookieStore.set(
            SESSION_COOKIE_NAME,
            JSON.stringify(session),
            SESSION_COOKIE_OPTIONS
        )
    } catch {
        // Session parsing failed, ignore
    }
}

/**
 * Get user from session cookie.
 * Returns null if no valid session exists.
 */
export async function getUserFromSession(): Promise<{ userId: string; email?: string } | null> {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) {
        return null
    }

    try {
        const session = JSON.parse(sessionCookie)
        if (!session.userId) {
            return null
        }
        return { userId: session.userId, email: session.email }
    } catch {
        return null
    }
}

/**
 * Clear the session cookie.
 * Call this on logout.
 */
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Initialize a session for the mock user (development only).
 * This sets the cookie so middleware can validate instantly.
 * Also checks if user has completed onboarding (has baseline).
 */
export async function initializeMockSession(hasBaseline: boolean = false): Promise<AuthUser | null> {
    // Check if we should simulate logout
    if (process.env.NEXT_PUBLIC_MOCK_AUTH_LOGOUT === "true") {
        await clearSessionCookie()
        return null
    }

    const mockUser: AuthUser = {
        id: process.env.MOCK_USER_ID || "user_cm618aaa0000001dummyuser01",
        email: process.env.MOCK_USER_EMAIL || "dev@example.com",
        timezone: process.env.MOCK_USER_TIMEZONE || "UTC",
    }

    await setSessionCookie(mockUser, hasBaseline)
    return mockUser
}
