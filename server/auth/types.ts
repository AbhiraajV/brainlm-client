export type AuthUser = {
    id: string;
    email?: string;
    timezone?: string;
};

export interface AuthAdapter {
    getCurrentUser(): Promise<AuthUser | null>;
}
