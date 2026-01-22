import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getBaseline } from "@/server/actions/onboarding.actions";
import { getPendingUOMSuggestions } from "@/server/actions/uom-suggestion.actions";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { UOMSuggestionList } from "@/components/profile/UOMSuggestionList";
import Link from "next/link";

export default async function MePage() {
  const user = await requireUser();
  const [baseline, pendingSuggestions] = await Promise.all([
    getBaseline(),
    getPendingUOMSuggestions(),
  ]);

  if (!baseline) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="
        sticky top-0 z-10
        h-14
        flex items-center justify-between
        px-5 sm:px-7
        bg-[var(--color-surface)]
        border-b border-[var(--color-line)]
      ">
        <div className="font-serif font-semibold text-lg text-[var(--color-text)]">
          About Me
        </div>
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] opacity-60" />
      </header>

      {/* Main content */}
      <main className="flex-1 py-6 sm:py-8 pb-24 px-4 sm:px-6">
        {/* UOM Suggestions section */}
        <UOMSuggestionList suggestions={pendingSuggestions} />

        {/* Divider if suggestions exist */}
        {pendingSuggestions.length > 0 && (
          <div className="divider my-8" />
        )}

        {/* Baseline section */}
        <p className="text-sm font-semibold italic text-[var(--color-muted)] mb-6">
          A slice of our ever evolving understanding of you! (we don't recommend visiting this page often — our goal is to do the heavy lifting for you 😊)
        </p>
        <div className="prose-baseline">
          <MarkdownRenderer content={baseline} />
        </div>
      </main>

      {/* Fixed back button - bottom left */}
      <Link
        href="/"
        className="
          fixed bottom-6 left-6
          z-20
          w-12 h-12
          flex items-center justify-center
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-full
          shadow-lg
          transition-all duration-200
          hover:shadow-xl hover:border-[var(--color-accent)]
          active:scale-95
        "
        aria-label="Go back to home"
      >
        <ArrowLeft className="w-5 h-5 text-[var(--color-text)]" />
      </Link>
    </div>
  );
}
