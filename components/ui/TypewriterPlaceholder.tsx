'use client';

import { useState, useEffect } from 'react';

const PLACEHOLDER_TEXTS = [
  // quantitative
  "chest day - bench 60kg x 8, incline 50kg x 10",
  // qualitative
  "feeling really motivated right now",
  // quantitative
  "meal #2: chicken caesar salad 250gms",
  // qualitative
  "mom called, was nice to catch up",
  // quantitative
  "slept 6.5 hours, woke up twice",
  // qualitative
  "brain won't shut up, can't focus",
  // quantitative
  "2 rotis, dal, paneer - ~400 cals",
  // qualitative
  "random thought: should I switch jobs?",
  // quantitative
  "morning walk: 3.2km in 35 mins",
  // qualitative
  "feeling anxious about the presentation",
  // quantitative
  "mass gainer shake + 2 bananas post workout",
  // qualitative
  "had a great convo with a stranger",
  // quantitative
  "water intake: 2.5L so far",
  // qualitative
  "feeling grateful right now, idk why",
];

interface TypewriterPlaceholderProps {
  isRecording: boolean;
  isProcessing: boolean;
}

export function useTypewriterPlaceholder({ isRecording, isProcessing }: TypewriterPlaceholderProps) {
  const [placeholder, setPlaceholder] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isRecording) {
      setPlaceholder('Listening...');
      return;
    }
    if (isProcessing) {
      setPlaceholder('Transcribing...');
      return;
    }

    const currentText = PLACEHOLDER_TEXTS[textIndex];

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (charIndex < currentText.length) {
          setPlaceholder(currentText.slice(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        } else {
          // Pause at end before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting
        if (charIndex > 0) {
          setPlaceholder(currentText.slice(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        } else {
          setIsDeleting(false);
          setTextIndex((textIndex + 1) % PLACEHOLDER_TEXTS.length);
        }
      }
    }, isDeleting ? 30 : 80);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, textIndex, isRecording, isProcessing]);

  return placeholder;
}
