export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] container-padding">
            <div className="
                w-full max-w-sm
                p-8
                bg-[var(--color-surface)]
                rounded-[var(--radius-lg)]
                shadow-[var(--shadow-card)]
            ">
                {/* Logo */}
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-3 h-3 rounded-full bg-[var(--color-accent)]" />
                    <span className="font-serif font-semibold text-xl text-[var(--color-text)]">
                        BrainLM
                    </span>
                </div>

                {/* Welcome text */}
                <h1 className="font-serif text-2xl text-[var(--color-text)] mb-2">
                    Welcome back
                </h1>
                <p className="text-[var(--color-muted)] text-sm mb-8">
                    Sign in to continue your reflection journey.
                </p>

                {/* Sign in button - ghost style per design language */}
                <button className="
                    w-full
                    py-3 px-4
                    text-sm font-medium
                    text-[var(--color-text)]
                    bg-[var(--color-bg)]
                    border border-[var(--color-line)]
                    rounded-[var(--radius-sm)]
                    transition-all duration-200
                    hover:border-[var(--color-accent)]
                    hover:bg-[var(--color-accent)]/5
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)]
                ">
                    Continue with Email
                </button>

                {/* Subtle footer */}
                <p className="text-center text-[11px] text-[var(--color-muted)] mt-6 tracking-wide">
                    Your thoughts, understood.
                </p>
            </div>
        </div>
    );
}
