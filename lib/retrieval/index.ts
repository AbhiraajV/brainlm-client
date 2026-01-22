/**
 * Retrieval API Library
 *
 * This library provides types and utilities for the Retrieval API, which
 * performs semantic search over user memory data (events, interpretations,
 * patterns, and insights).
 *
 * ## Architecture
 *
 * The retrieval API runs on a separate Express server (default: port 3001)
 * and implements a 7-step RAG (Retrieval-Augmented Generation) pipeline:
 *
 * 1. **Compile semantic queries** - LLM generates table-specific search intents
 * 2. **Embed queries** - Generate embeddings for each table's search intent
 * 3. **Retrieve from all tables** - Parallel pgvector similarity searches
 * 4. **Expand events** - Fetch linked interpretations, patterns, insights
 * 5. **Normalize evidence** - Convert to unified format
 * 6. **Deduplicate & control** - Remove duplicates, ensure temporal coverage
 * 7. **Return structured context** - Ready for downstream synthesis
 *
 * ## Usage
 *
 * For client-side usage, prefer the server action:
 *
 * ```tsx
 * import { retrieve } from '@/server/actions/retrieval.actions';
 *
 * async function handleSearch(query: string) {
 *   const result = await retrieve({ mainQuestion: query });
 *
 *   if ('error' in result) {
 *     console.error(result.error);
 *     return;
 *   }
 *
 *   // Process results
 *   for (const questionResult of result.results) {
 *     console.log(`Intent: ${questionResult.intentType}`);
 *     console.log(`Events: ${questionResult.retrievedContext.events.length}`);
 *   }
 * }
 * ```
 *
 * ## Types
 *
 * The main types you'll work with:
 *
 * - `RetrieveInput` - Input for the retrieve endpoint
 * - `RetrieveResult` - Success response with all results
 * - `QuestionResult` - Result for a single question
 * - `NormalizedEvidence` - Unified evidence format
 *
 * @packageDocumentation
 */

// Types
export * from './types';

// Client (for server-side usage only)
export { fetchRetrieve, checkHealth, API_BASE_URL } from './client';
export type { RetrieveOptions } from './client';
