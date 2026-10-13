import type { MessageKey } from '../i18n/messages';

// Presentation metadata only; membership comes from each original level's concept.
export const PRACTICE_CONCEPTS: Record<string, { nameKey: MessageKey; emoji: string }> = {
  'Sequence and repeat loops': { nameKey: 'practice.concept.sequence', emoji: '🔁' },
  'Conditionals': { nameKey: 'practice.concept.conditionals', emoji: '🧭' },
  'While loops and negation': { nameKey: 'practice.concept.while', emoji: '🔄' },
  'Functions and decomposition': { nameKey: 'practice.concept.functions', emoji: '🛠️' },
  'Recursion and advanced control flow': { nameKey: 'practice.concept.recursion', emoji: '🌀' },
};
