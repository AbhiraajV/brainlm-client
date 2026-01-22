/**
 * Server Actions - Barrel Export
 *
 * All server actions exported from a single entry point.
 * Import with: import { eventActions, queueActions, ... } from "@/server/actions"
 *
 * Due to naming conflicts (getById, getMany, etc.), entity actions are exported
 * as namespaces rather than individual functions.
 */

// Event operations (namespace to avoid conflicts)
import * as eventActions from './event.actions';
import * as eventSuggestionActions from './event-suggestion.actions';
export { eventActions, eventSuggestionActions };

// Analysis & retrieval
export * from './analysis.actions';
export * from './retrieval.actions';

// Knowledge entities (namespaced due to getById/getMany conflicts)
import * as interpretationActions from './interpretation.actions';
import * as patternActions from './pattern.actions';
import * as insightActions from './insight.actions';
import * as reviewActions from './review.actions';
export { interpretationActions, patternActions, insightActions, reviewActions };

// Planning
export * from './daily-plan.actions';

// Queue & processing
export * from './queue.actions';
export * from './review-generation.actions';

// UOM suggestions
export * from './uom-suggestion.actions';

// Session
export * from './session-complete.actions';
export * from './session-knowledge.actions';
export * from './session-understanding.actions';

// Onboarding
export * from './onboarding.actions';

// Utilities
export * from './stt.actions';
