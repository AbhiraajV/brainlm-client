import { AuthAdapter, AuthUser } from "./types";

export class MockAuthAdapter implements AuthAdapter {
    async getCurrentUser(): Promise<AuthUser | null> {
        // In development, we return a mock user from env or hardcoded default
        // This simulates an authenticated session

        // Check if we should simulate logout
        if (process.env.NEXT_PUBLIC_MOCK_AUTH_LOGOUT === "true") {
            return null;
        }

        return {
            id: process.env.MOCK_USER_ID || "user_cm618aaa0000001dummyuser01",
            email: process.env.MOCK_USER_EMAIL || "dev@example.com",
            timezone: process.env.MOCK_USER_TIMEZONE || "UTC",
        };
    }
}
