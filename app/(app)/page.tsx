import { Suspense } from "react";
import { EventFeed, DateRangeFilter, AnalysisStats } from "@/components/event-feed";
import { TimeGreeting } from "@/components/ui/TimeGreeting";
import { GoToSessionsButton } from "@/components/sessions";
import { requireUser } from "@/server/auth";

export const dynamic = 'force-dynamic';

const filterLabels: Record<string, string> = {
    all: 'all time',
    today: 'today',
    yesterday: 'yesterday',
    week: 'this week',
    month: 'this month',
    '30days': 'in the last 30 days'
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

// Auth + baseline check already done in (app)/layout.tsx
export default async function Page({
    searchParams
}: {
    searchParams: SearchParams
}) {
    // Parallel: Get user and parse params simultaneously (auth already validated by middleware)
    const [user, params] = await Promise.all([
        requireUser(),
        searchParams
    ]);

    // Extract date filter from URL params
    const dateFilter = params.from || params.to
        ? {
            from: typeof params.from === 'string' ? params.from : undefined,
            to: typeof params.to === 'string' ? params.to : undefined
        }
        : undefined;

    // Get filter type for label
    const filterType = typeof params.filter === 'string' ? params.filter : 'today';
    const filterLabel = filterLabels[filterType] || 'today';

    // User is guaranteed to exist (layout validated auth)
    const userName = user?.email ? user.email.split('@')[0] : undefined;

    return (
        <>
            <div className="space-y-6">
                {/* Greeting */}
                {/* <TimeGreeting name={userName} /> */}

                {/* Date filter */}
                <Suspense fallback={<div className="h-10" />}>
                    <DateRangeFilter />
                </Suspense>

                {/* Analysis stats */}
                <AnalysisStats dateFilter={dateFilter} filterLabel={filterLabel} />

                {/* Event feed - progressive caching, filters client-side */}
                <EventFeed limit={20} />
            </div>

            {/* Fixed sessions button - bottom left */}
            <GoToSessionsButton />
        </>
    );
}
