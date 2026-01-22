Perfect — this is a **hard systems problem**, not a UI one. I’ll give you a **plan-of-a-plan** that a strong code writer can execute *without guessing*. No fluff, no JSX yet, only **precise architecture, contracts, and state flows**.

---

# Event Feed + Progressive Analysis Rendering

**(Plan-of-a-Plan for Code Writer)**

---

## 0. Non-Negotiable Principles

1. **Events are immutable, analyses are progressive**
2. **Never block event rendering on analysis**
3. **Cache only completed analysis**
4. **In-flight analysis is observable, not cached**
5. **No duplicate fetches across events**
6. **Server is source of truth, client orchestrates visibility**

---

## 1. Data Model Assumptions (Explicit)

### Event

* Always exists
* Renderable immediately

### Interpretation / Pattern / Insight

* Created asynchronously
* May arrive in **any order**
* May be **missing indefinitely**

### “Completely analysed” definition (hard rule)

An event is **complete** iff:

* ≥1 Interpretation exists
* ≥1 Insight exists
* ≥1 Pattern exists **OR** system marks `patterns_exhausted = true`

This condition must be computable server-side.

---

## 2. Server-Side Contracts (CRITICAL)

### 2.1 Event Pagination (Cursor-based)

```ts
getEventsPage({
  cursor?: string,
  limit: number
}) → {
  events: Event[],
  nextCursor?: string
}
```

* Ordered by `createdAt DESC`
* Cursor = last event ID
* **Cached aggressively** (static-ish)

---

### 2.2 Analysis Status Resolver (per event)

```ts
getEventAnalysisStatus(eventId) → {
  interpretation: "missing" | "present",
  insight: "missing" | "present",
  pattern: "missing" | "present" | "exhausted",
  isComplete: boolean,
  lastUpdatedAt: Date
}
```

* **Fast**
* No joins on content bodies
* Used to decide caching + polling

---

### 2.3 Content Fetchers (deduplicatable)

```ts
getInterpretationsByEvent(eventId)
getInsightsByEvent(eventId)
getPatternsByEvent(eventId)
```

Rules:

* These return **content**
* Cacheable **only if analysis is complete**
* Otherwise marked `no-store`

---

## 3. Caching Strategy (THIS IS THE CORE)

### 3.1 Cache Layers

| Layer             | Purpose                             | Cache Policy               |
| ----------------- | ----------------------------------- | -------------------------- |
| Event list        | Timeline browsing                   | Long TTL                   |
| Analysis status   | Completion check                    | Short TTL                  |
| Analysis content  | Interpretations, patterns, insights | Cache **only if complete** |
| In-flight polling | Partial analysis                    | No cache                   |

---

### 3.2 Cache Keys (Shared Across Events)

Key idea:
**Analysis objects are shared resources**, not owned by the event component.

Example:

```ts
analysis:interpretation:event:{eventId}
analysis:pattern:event:{eventId}
analysis:insight:event:{eventId}
```

This prevents:

* Multiple events triggering same fetch
* Re-fetch storms on expand/collapse

---

## 4. Client Architecture (Precise)

### 4.1 Main Feed Component

**Responsibilities**

* Infinite scroll
* Event shell rendering
* NO analysis logic

**State**

```ts
{
  events: Event[],
  cursor?: string,
  isLoadingMore: boolean
}
```

---

### 4.2 EventRow Component (Key Orchestrator)

Each event row:

* Renders immediately
* Owns **visibility**, not data fetching
* Delegates analysis logic to hooks

---

### 4.3 Analysis Controller Hook (IMPORTANT)

```ts
useEventAnalysis(eventId)
```

Returns:

```ts
{
  status,
  interpretation?,
  insight?,
  pattern?,
  isPolling,
  thinkingState
}
```

Responsibilities:

1. Fetch analysis **status**
2. Decide:

   * fetch cached content
   * or poll for missing pieces
3. Deduplicate fetches globally
4. Stop polling once complete

---

## 5. Polling Logic (VERY PRECISE)

### 5.1 When polling starts

* If **any** analysis dimension is missing

### 5.2 Poll frequency

* Adaptive:

  * First 30s: every 3s
  * Next 2 min: every 10s
  * Then stop (mark “pending background processing”)

### 5.3 Poll target

* ONLY `getEventAnalysisStatus`
* Never poll full content

### 5.4 When polling stops

* `isComplete === true`
* OR timeout exceeded

---

## 6. Progressive Rendering Rules

| State                | What user sees              |
| -------------------- | --------------------------- |
| Event only           | Timestamp + content         |
| Analysis missing     | “Processing signals…”       |
| Interpretation ready | Show Interpretation section |
| Insight ready        | Append Insight              |
| Pattern ready        | Append Pattern              |
| Partial              | Mixed state allowed         |
| Complete             | All sections + cached       |

---

## 7. “System Thinking” Messaging (Controlled, Non-Therapy)

### Message categories (rotate randomly):

* **Signal extraction**

  * “Extracting salient signals”
  * “Normalizing event context”

* **Structural analysis**

  * “Checking cross-event consistency”
  * “Evaluating recurrence probability”

* **Quantitative inference**

  * “Assessing deviation from baseline”
  * “Evaluating magnitude vs noise”

* **Pattern synthesis**

  * “Comparing against prior sequences”
  * “Determining pattern sufficiency”

Rules:

* Never emotional
* Never anthropomorphic
* Never promise outcomes

---

## 8. Shared Fetch Optimization (Critical)

### Global In-Flight Registry

```ts
Map<cacheKey, Promise>
```

Rules:

* If a fetch is in-flight, reuse promise
* If resolved & cacheable, store result
* If not cacheable, discard on completion

This avoids:

* N events opening → N identical fetches
* Accordion spam

---

## 9. Revalidation Rules

### When to revalidate cached analysis

* ONLY when:

  * New event added
  * Or explicit “refresh analysis” action
* Never on expand/collapse

---

## 10. Failure & Edge Handling

| Scenario                 | Behavior                                 |
| ------------------------ | ---------------------------------------- |
| No analysis ever arrives | Show “No sufficient data yet”            |
| Partial forever          | Show what exists, mark others pending    |
| 0 related memory         | Explicitly state “No related prior data” |
| Backend delay            | UI remains stable                        |

---

## 11. What the Code Writer Should NOT Do

❌ Fetch analysis eagerly for all events
❌ Cache partial analysis
❌ Tie rendering to completion
❌ Assume order of interpretation/insight/pattern
❌ Use client state as truth

---

## 12. Deliverable Expectation

The result should feel like:

* **A live analytical system**
* Not a chat UI
* Not a journaling app
* Not a therapist
* More like **an internal intelligence console**

---

If you want next, I’d strongly recommend:
**“Exact Prisma indexes + query shapes to make this cheap”**
because this design *will* melt your DB without them.

Say the word.
