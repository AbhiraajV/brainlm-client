export type AuthUser = {
    id: string;
    email?: string;
    timezone?: string;
    hasBaseline?: boolean;
};

export interface AuthAdapter {
    getCurrentUser(): Promise<AuthUser | null>;
}
