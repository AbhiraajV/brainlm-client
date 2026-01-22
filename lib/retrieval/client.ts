/**
 * Retrieval API Client
 *
 * Low-level client for calling the retrieval API on the Express server.
 * This is an internal module - prefer using the server actions in
 * `@/server/actions/retrieval.actions.ts` for client-side usage.
 *
 * @internal
 */

import type {
  RetrieveInput,
  RetrieveResult,
  RetrieveError,
  RetrieveResponse,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Base URL for the retrieval API server.
 *
 * Defaults to localhost:3000 for local development.
 * Can be overridden via RETRIEVAL_API_URL environment variable.
 */
const API_BASE_URL = process.env.RETRIEVAL_API_URL || 'http://localhost:3001';

/**
 * Default timeout for API requests in milliseconds.
 * Set to 2 minutes to allow for complex retrieval operations
 * that query multiple LLMs and databases.
 */
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes

// ============================================================================
// API Client
// ============================================================================

/**
 * Options for the retrieve function.
 */
export interface RetrieveOptions {
  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Additional headers to send with the request */
  headers?: Record<string, string>;

  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
}

/**
 * Call the retrieve endpoint on the Express server.
 *
 * This is a low-level function. For client-side usage, prefer:
 * ```ts
 * import { retrieve } from '@/server/actions/retrieval.actions';
 * ```
 *
 * @param input - Retrieval input parameters
 * @param userId - User ID for authentication
 * @param options - Optional request options
 * @returns Retrieval result or error
 *
 * @example
 * ```ts
 * const result = await fetchRetrieve(
 *   { mainQuestion: "What foods have I been eating?" },
 *   "user-123"
 * );
 *
 * if (isRetrieveError(result)) {
 *   console.error(result.error);
 * } else {
 *   console.log(result.results);
 * }
 * ```
 */
export async function fetchRetrieve(
  input: RetrieveInput,
  userId: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResponse> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, signal } = options;

  // Create timeout controller if not provided
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass user ID for mock auth (in production, this would be a JWT)
        'X-User-Id': userId,
        ...headers,
      },
      body: JSON.stringify(input),
      signal: signal || controller.signal,
    });

    if (!response.ok) {
      // Try to parse error message from response
      const errorData = await response.json().catch(() => ({}));
      return {
        error:
          (errorData as { error?: string }).error ||
          `Request failed with status ${response.status}`,
      };
    }

    const data = await response.json();
    return data as RetrieveResult;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { error: 'Request timed out' };
      }
      return { error: error.message };
    }
    return { error: 'Unknown error occurred' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if the retrieval API server is healthy.
 *
 * @returns true if server is reachable and healthy
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { API_BASE_URL };
