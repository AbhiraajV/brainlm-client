'use client';

import { useEffect, useState } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { OnboardingContainer } from '@/components/onboarding/OnboardingContainer';

export default function OnboardingPage() {
  // Handle hydration mismatch - wait for client-side store to hydrate
  const [isHydrated, setIsHydrated] = useState(false);
  const currentStepIndex = useOnboardingStore((state) => state.currentStepIndex);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Show loading state while hydrating to avoid flash
  if (!isHydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <OnboardingContainer />;
}
