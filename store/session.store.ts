import { create } from 'zustand';
import { AuthUser } from '@/server/auth/types';

interface SessionState {
    user: AuthUser | null;
    setUser: (user: AuthUser | null) => void;
}

// Client-side session mirror.
// Note: Verification always happens server-side. This is just for UI binding.
export const useSessionStore = create<SessionState>((set) => ({
    user: null,
    setUser: (user) => set({ user }),
}));
