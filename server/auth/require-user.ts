import { redirect } from "next/navigation";
import { getAuthAdapter } from "./adapter";
import { AuthUser } from "./types";

/**
 * Enforces authentication.
 * If no user is found, redirects to /login (or throws in strict mode).
 * 
 * Usage: const user = await requireUser();
 */
export async function requireUser(): Promise<AuthUser> {
    const adapter = getAuthAdapter();
    const user = await adapter.getCurrentUser();

    if (!user) {
        // HARD GATE: No user -> No access.
        // In a real app, this redirects to the login provider.
        // For this foundation, we redirect to a simple login/unauthorized page.
        redirect("/login");
    }

    return user;
}
