import { Suspense } from "react";
import { EventFeed, DateRangeFilter, AnalysisStats } from "@/components/event-feed";
import { requireUser } from "@/server/auth";
import { TimeGreeting } from "@/components/ui/TimeGreeting";
import { GoToSessionsButton } from "@/components/sessions";

const filterLabels: Record<string, string> = {
    all: 'all time',
    today: 'today',
    yesterday: 'yesterday',
    week: 'this week',
    month: 'this month',
    '30days': 'in the last 30 days'
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function Page({
    searchParams
}: {
    searchParams: SearchParams
}) {
    const user = await requireUser();
    const params = await searchParams;

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

    const userName = user.email ? user.email.split('@')[0] : undefined;

    return (
        <>
            <div className="space-y-6">
                {/* Greeting */}
                <TimeGreeting name={userName} />

                {/* Date filter */}
                <Suspense fallback={<div className="h-10" />}>
                    <DateRangeFilter />
                </Suspense>

                {/* Analysis stats */}
                <AnalysisStats dateFilter={dateFilter} filterLabel={filterLabel} />

                {/* Event feed */}
                <EventFeed limit={20} dateFilter={dateFilter} />
            </div>

            {/* Fixed sessions button - bottom left */}
            <GoToSessionsButton />
        </>
    );
}
