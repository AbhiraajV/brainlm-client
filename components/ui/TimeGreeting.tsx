'use client';

import { useState, useEffect } from 'react';

interface TimeGreetingProps {
  name?: string;
}

function getGreeting(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return { greeting: 'Good morning', emoji: '☀️' };
  } else if (hour >= 12 && hour < 17) {
    return { greeting: 'Good afternoon', emoji: '🌤️' };
  } else if (hour >= 17 && hour < 21) {
    return { greeting: 'Good evening', emoji: '🌅' };
  } else {
    return { greeting: 'Good night', emoji: '🌙' };
  }
}

export function TimeGreeting({ name }: TimeGreetingProps) {
  const [mounted, setMounted] = useState(false);
  const [greetingData, setGreetingData] = useState({ greeting: 'Hello', emoji: '👋' });

  useEffect(() => {
    setMounted(true);
    setGreetingData(getGreeting());
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <header className="space-y-1">
        <span className="font-serif text-xl sm:text-xl text-[var(--color-text)]">
          Hello{name ? `, ${name}` : ''} 👋
        </span>
      </header>
    );
  }

  return (
    <header className="space-y-1">
      <span className="font-serif text-xl sm:text-xl font-semibold text-[var(--color-text)]">
        {greetingData.greeting}{name ? `, ${name}` : ''} {greetingData.emoji}
      </span>
    </header>
  );
}
