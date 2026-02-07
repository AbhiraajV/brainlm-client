import { Suspense } from "react";
import { EventFeed, DateRangeFilter, AnalysisStats } from "@/components/event-feed";
import { GoToSessionsButton } from "@/components/sessions";
import { SleepMorningPrompt } from "@/components/sleep/SleepMorningPrompt";
import { SleepBedtimeButton } from "@/components/sleep/SleepBedtimeButton";

export default async function Page() {
    return (
        <>
            <div className="space-y-1.5">
                {/* Date filter */}
                <Suspense fallback={<div className="h-10" />}>
                    <DateRangeFilter />
                </Suspense>

                {/* Analysis stats */}
                <AnalysisStats />

                {/* Event feed - progressive caching, filters client-side */}
                <EventFeed limit={20} />
            </div>

            {/* Sleep tracking overlays */}
            <SleepMorningPrompt />
            <SleepBedtimeButton />

            {/* Fixed sessions button - bottom left */}
            <GoToSessionsButton />
        </>
    );
}
