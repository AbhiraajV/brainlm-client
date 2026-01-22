import { requireUser } from "../auth";

export async function withAuth<T>(action: (userId: string, ...args: any[]) => Promise<T>): Promise<T> {
    const user = await requireUser();
    // We can pass arguments through, but simplified here we just want to ensure
    // the usage pattern forces userId retrieval from the session.
    // Ideally, we'd wrap functions, but simpler in this strictly typed setup:
    // Callers inside actions just call `const user = await requireUser()` at the top.
    // This helper might be useful for higher-order wrapping if needed later.

    // Actually, per instructions "All actions must Call requireUser()".
    // A wrapper approach:
    throw new Error("Use explicit requireUser() calls inside actions for clarity and type safety per instructions.");
}

// Re-export specific helpers if needed
