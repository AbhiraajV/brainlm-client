import { cookies } from 'next/headers'
import { AuthAdapter, AuthUser } from "./types";

const SESSION_COOKIE_NAME = 'brainlm-session'

export class MockAuthAdapter implements AuthAdapter {
    async getCurrentUser(): Promise<AuthUser | null> {
        // In development, check for session cookie first (set by middleware flow)
        // If no cookie, fall back to env-based mock user for backward compatibility

        // Check if we should simulate logout
        if (process.env.NEXT_PUBLIC_MOCK_AUTH_LOGOUT === "true") {
            return null;
        }

        // Try to get user from session cookie (fast path - already validated by middleware)
        try {
            const cookieStore = await cookies()
            const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

            if (sessionCookie) {
                const session = JSON.parse(sessionCookie)
                if (session.userId) {
                    return {
                        id: session.userId,
                        email: session.email || process.env.MOCK_USER_EMAIL || "dev@example.com",
                        timezone: process.env.MOCK_USER_TIMEZONE || "UTC",
                    }
                }
            }
        } catch {
            // Cookie parsing failed, fall through to default mock user
        }

        // Fallback: return default mock user (for server actions, initial setup, etc.)
        return {
            id: process.env.MOCK_USER_ID || "user_cm618aaa0000001dummyuser01",
            email: process.env.MOCK_USER_EMAIL || "dev@example.com",
            timezone: process.env.MOCK_USER_TIMEZONE || "UTC",
        };
    }
}
