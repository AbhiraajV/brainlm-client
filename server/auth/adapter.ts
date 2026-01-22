import { AuthAdapter } from "./types";
import { MockAuthAdapter } from "./mock.adapter";

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
