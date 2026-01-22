'use server';

/**
 * Retrieval API Server Actions
 *
 * These server actions provide a secure interface to the Retrieval API
 * from client-side React components. They handle authentication and
 * forward requests to the Express server.
 *
 * ## Usage
 *
 * ```tsx
 * 'use client';
 *
 * import { retrieve, retrieveWithSubQuestions } from '@/server/actions/retrieval.actions';
 *
 * export function SearchComponent() {
 *   const [results, setResults] = useState(null);
 *
 *   async function handleSearch(query: string) {
 *     const result = await retrieve({ mainQuestion: query });
 *
 *     if ('error' in result) {
 *       toast.error(result.error);
 *       return;
 *     }
 *
 *     setResults(result);
 *   }
 *
 *   // ...
 * }
 * ```
 *
 * ## API Details
 *
 * The retrieve endpoint performs semantic search using vector similarity:
 *
 * 1. Compiles table-specific search intents from your question
 * 2. Generates embeddings and searches across Events, Interpretations,
 *    Patterns, and Insights tables
 * 3. Expands events with their linked data
 * 4. Deduplicates and normalizes results
 *
 * Typical response times: 1-3 seconds depending on query complexity.
 *
 * @module retrieval.actions
 */

import { requireUser } from '@/server/auth';
import {
  fetchRetrieve,
  checkHealth,
  type RetrieveInput,
  type RetrieveResponse,
  type TimeRange,
} from '@/lib/retrieval';

// ============================================================================
// Main Actions
// ============================================================================

/**
 * Retrieve relevant context for a question.
 *
 * This is the primary retrieval action. It searches across all memory tables
 * (events, interpretations, patterns, insights) using semantic similarity.
 *
 * @param input - Retrieval parameters
 * @returns Retrieval result with context from all tables, or error
 *
 * @example Basic retrieval
 * ```tsx
 * const result = await retrieve({
 *   mainQuestion: "What foods have I been eating recently?"
 * });
 *
 * if ('error' in result) {
 *   console.error(result.error);
 * } else {
 *   // Access results for the main question
 *   const mainResult = result.results[0];
 *   console.log(`Found ${mainResult.retrievedContext.events.length} events`);
 * }
 * ```
 *
 * @example With time range
 * ```tsx
 * const result = await retrieve({
 *   mainQuestion: "What workouts did I do?",
 *   timeRange: {
 *     from: "2024-01-01",
 *     to: "2024-01-31"
 *   }
 * });
 * ```
 */
export async function retrieve(
  input: RetrieveInput
): Promise<RetrieveResponse> {
  const user = await requireUser();

  return fetchRetrieve(input, user.id);
}

/**
 * Retrieve with automatic sub-question generation.
 *
 * This is a convenience wrapper that enables sub-question generation.
 * The API will use an LLM to decompose your main question into more
 * specific sub-questions, then retrieve context for each.
 *
 * This is useful for complex questions that require multiple perspectives.
 *
 * @param mainQuestion - The main question to answer
 * @param context - Context for sub-question generation (e.g., user profile, conversation)
 * @param maxSubQuestions - Maximum sub-questions to generate (default: 5)
 * @param timeRange - Optional time range filter
 * @returns Retrieval result with context for main and sub-questions
 *
 * @example
 * ```tsx
 * const result = await retrieveWithSubQuestions(
 *   "Why am I feeling tired lately?",
 *   "User has been tracking sleep, exercise, and nutrition...",
 *   3  // Generate up to 3 sub-questions
 * );
 *
 * if (!('error' in result)) {
 *   console.log(`Generated ${result.subQuestions?.length} sub-questions`);
 *   // Each sub-question has its own results
 *   for (const qResult of result.results) {
 *     console.log(`${qResult.question}: ${qResult.retrievedContext.events.length} events`);
 *   }
 * }
 * ```
 */
export async function retrieveWithSubQuestions(
  mainQuestion: string,
  context: string,
  maxSubQuestions: number = 5,
  timeRange?: TimeRange
): Promise<RetrieveResponse> {
  const user = await requireUser();

  return fetchRetrieve(
    {
      mainQuestion,
      generateSubQuestions: true,
      context,
      maxSubQuestions,
      timeRange,
    },
    user.id
  );
}

/**
 * Retrieve with pre-defined sub-questions.
 *
 * Use this when you already know what sub-questions to ask,
 * rather than having the API generate them.
 *
 * @param mainQuestion - The main question
 * @param subQuestions - Array of sub-questions to retrieve for
 * @param timeRange - Optional time range filter
 * @returns Retrieval result with context for all questions
 *
 * @example
 * ```tsx
 * const result = await retrieveWithQuestions(
 *   "How is my fitness progress?",
 *   [
 *     "What strength exercises have I done?",
 *     "How has my endurance changed?",
 *     "What are my recovery patterns?"
 *   ]
 * );
 * ```
 */
export async function retrieveWithQuestions(
  mainQuestion: string,
  subQuestions: string[],
  timeRange?: TimeRange
): Promise<RetrieveResponse> {
  const user = await requireUser();

  return fetchRetrieve(
    {
      mainQuestion,
      subQuestions,
      timeRange,
    },
    user.id
  );
}

// ============================================================================
// Utility Actions
// ============================================================================

/**
 * Check if the retrieval API is available.
 *
 * Use this to verify connectivity before making retrieve calls,
 * or to show a status indicator in the UI.
 *
 * @returns true if the API is healthy and reachable
 *
 * @example
 * ```tsx
 * const isHealthy = await isRetrievalApiHealthy();
 *
 * if (!isHealthy) {
 *   toast.error("Retrieval service is unavailable");
 * }
 * ```
 */
export async function isRetrievalApiHealthy(): Promise<boolean> {
  // No auth required for health check
  return checkHealth();
}
