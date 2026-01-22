import { create } from 'zustand';

export type FullscreenContentType = 'interpretation' | 'insight' | 'pattern' | 'review' | 'event' | 'plan';

export interface FullscreenContent {
    id: string;
    content?: string;
    statement?: string;
    explanation?: string;
    description?: string;
    source?: string;
    confidence?: string;
    status?: string;
    category?: string;
    temporalScope?: string;
    eventCount?: number;
    reinforcementCount?: number;
    firstDetectedAt?: Date;
    lastReinforcedAt?: Date;
    // Review-specific fields
    reviewType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    periodKey?: string;
    periodStart?: Date;
    periodEnd?: Date;
    summary?: string;
    // Event-specific fields
    title?: string;
    occurredAt?: Date;
    // Plan-specific fields
    planTitle?: string;
    targetDate?: Date;
}

interface FullscreenReaderState {
    isOpen: boolean;
    contentType: FullscreenContentType;
    content: FullscreenContent | null;
}

interface UiState {
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    fullscreenReader: FullscreenReaderState;
    openFullscreenReader: (type: FullscreenContentType, content: FullscreenContent) => void;
    closeFullscreenReader: () => void;
}

export const useUiStore = create<UiState>((set) => ({
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    theme: 'dark',
    setTheme: (theme) => set({ theme }),
    fullscreenReader: {
        isOpen: false,
        contentType: 'interpretation',
        content: null,
    },
    openFullscreenReader: (type, content) => set({
        fullscreenReader: {
            isOpen: true,
            contentType: type,
            content,
        }
    }),
    closeFullscreenReader: () => set((state) => ({
        fullscreenReader: {
            ...state.fullscreenReader,
            isOpen: false,
        }
    })),
}));
