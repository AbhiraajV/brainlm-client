import { requireUser } from "@/server/auth";
import { ReactNode } from "react";

export const dynamic = 'force-dynamic';

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  // Require authentication - redirects to /login if not authenticated
  await requireUser();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Minimal header - just branding */}
      <header className="
        h-14
        flex items-center justify-center
        px-5 sm:px-7
        bg-[var(--color-surface)]
        border-b border-[var(--color-line)]
      ">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
          <span className="font-serif font-semibold text-lg text-[var(--color-text)]">
            Motif
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
