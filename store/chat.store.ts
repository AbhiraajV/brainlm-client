import { create } from 'zustand';

interface ChatState {
    messages: any[]; // Define strict types later
    isTyping: boolean;
    addMessage: (msg: any) => void;
    setTyping: (typing: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    isTyping: false,
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    setTyping: (isTyping) => set({ isTyping }),
}));
