/**
 * Retrieval analytics (admin).
 *
 * Every assistant reply persists a compact retrieval-provenance record on the
 * message's `metadata` column (kind:"retrieval"). This module reads those records
 * and aggregates them into the metrics the admin dashboard shows: brain usage,
 * failed/zero-result retrievals, clarification frequency, retrieval method mix,
 * top documents, and top queries.
 *
 * The aggregators are PURE functions over an event array so they can be unit
 * tested without a database; getRetrievalAnalytics() is the only DB-touching fn.
 */
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";

export const RETRIEVAL_EVENT_KIND = "retrieval" as const;

/**
 * Redact obvious PII before a query is persisted for analytics. Emails, phone
 * numbers, and long digit runs (cards / SSNs / account numbers) are masked so
 * the admin "top queries" view never surfaces raw sensitive data. Names are not
 * detectable heuristically and are out of scope; the query is also truncated by
 * the caller. Applied at write time so nothing sensitive lands in the DB.
 */
export function sanitizeQueryForLog(q: string, maxLen = 160): string {
  return q
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[phone]")
    .replace(/\b\d{6,}\b/g, "[number]")
    .trim()
    .slice(0, maxLen);
}

export interface RetrievalEvent {
  brainSlug: string | null;
  brainMode: "smart" | "manual";
  multiBrains: string[] | null;
  confidence: number | null;
  knowledgeCount: number;
  memoryCount: number;
  retrievalMethod: "none" | "keyword-fallback" | "semantic";
  wasClarify: boolean;
  wasZeroResult: boolean;
  sources: string[];
  query: string;
}

export interface RetrievalAnalytics {
  totalTurns: number;
  brainUsage: Array<{ brain: string; count: number }>;
  retrievalMethods: { semantic: number; keywordFallback: number; none: number };
  clarification: { count: number; rate: number };
  zeroResults: { count: number; rate: number; recentQueries: string[] };
  /** Turns that wanted knowledge but retrieved nothing (== zeroResults.count). */
  failedRetrievals: number;
  topDocuments: Array<{ title: string; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
}

/* --------------------------- pure aggregators ---------------------------- */

/** Usage per brain, with multi-brain and unrouted (clarify / none) buckets. */
export function aggregateBrainUsage(events: RetrievalEvent[]): Array<{ brain: string; count: number }> {
  const m = new Map<string, number>();
  for (const e of events) {
    const key =
      e.multiBrains && e.multiBrains.length >= 2 ? "multi"
      : e.brainSlug ? e.brainSlug
      : e.wasClarify ? "clarify"
      : "none";
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([brain, count]) => ({ brain, count }))
    .sort((a, b) => b.count - a.count || a.brain.localeCompare(b.brain));
}

export function aggregateRetrievalMethods(events: RetrievalEvent[]) {
  let semantic = 0, keywordFallback = 0, none = 0;
  for (const e of events) {
    if (e.retrievalMethod === "semantic") semantic++;
    else if (e.retrievalMethod === "keyword-fallback") keywordFallback++;
    else none++;
  }
  return { semantic, keywordFallback, none };
}

export function aggregateClarification(events: RetrievalEvent[]) {
  const count = events.filter((e) => e.wasClarify).length;
  return { count, rate: events.length ? count / events.length : 0 };
}

export function aggregateZeroResults(events: RetrievalEvent[]) {
  const zr = events.filter((e) => e.wasZeroResult);
  // events arrive newest-first; keep the most recent distinct queries.
  const recentQueries: string[] = [];
  const seen = new Set<string>();
  for (const e of zr) {
    const q = e.query.trim();
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    recentQueries.push(q);
    if (recentQueries.length >= 10) break;
  }
  return { count: zr.length, rate: events.length ? zr.length / events.length : 0, recentQueries };
}

export function topDocuments(events: RetrievalEvent[], n = 10): Array<{ title: string; count: number }> {
  const m = new Map<string, number>();
  for (const e of events) for (const t of e.sources) {
    if (!t) continue;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, n);
}

export function topQueries(events: RetrievalEvent[], n = 10): Array<{ query: string; count: number }> {
  // Dedup case-insensitively but display the first-seen original casing.
  const m = new Map<string, { display: string; count: number }>();
  for (const e of events) {
    const raw = e.query.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const cur = m.get(key);
    if (cur) cur.count++;
    else m.set(key, { display: raw, count: 1 });
  }
  return [...m.values()]
    .map((v) => ({ query: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count || a.query.localeCompare(b.query))
    .slice(0, n);
}

/** Compose every metric from a raw event list (newest-first). */
export function computeRetrievalAnalytics(events: RetrievalEvent[]): RetrievalAnalytics {
  const zeroResults = aggregateZeroResults(events);
  return {
    totalTurns: events.length,
    brainUsage: aggregateBrainUsage(events),
    retrievalMethods: aggregateRetrievalMethods(events),
    clarification: aggregateClarification(events),
    zeroResults,
    failedRetrievals: zeroResults.count,
    topDocuments: topDocuments(events),
    topQueries: topQueries(events),
  };
}

/** Coerce a stored message.metadata blob into a typed event (or null if not one). */
export function eventFromMetadata(md: unknown): RetrievalEvent | null {
  if (!md || typeof md !== "object") return null;
  const r = md as Record<string, unknown>;
  if (r.kind !== RETRIEVAL_EVENT_KIND) return null;
  return {
    brainSlug: (r.brainSlug as string) ?? null,
    brainMode: (r.brainMode as "smart" | "manual") ?? "smart",
    multiBrains: Array.isArray(r.multiBrains) ? (r.multiBrains as string[]) : null,
    confidence: typeof r.confidence === "number" ? r.confidence : null,
    knowledgeCount: typeof r.knowledgeCount === "number" ? r.knowledgeCount : 0,
    memoryCount: typeof r.memoryCount === "number" ? r.memoryCount : 0,
    retrievalMethod: (r.retrievalMethod as RetrievalEvent["retrievalMethod"]) ?? "none",
    wasClarify: !!r.wasClarify,
    wasZeroResult: !!r.wasZeroResult,
    sources: Array.isArray(r.sources) ? (r.sources as string[]) : [],
    query: typeof r.query === "string" ? r.query : "",
  };
}

/* ------------------------------- DB reader ------------------------------- */

export async function getRetrievalAnalytics(days = 30, limit = 5000): Promise<RetrievalAnalytics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ metadata: messages.metadata })
    .from(messages)
    .where(and(eq(messages.role, "assistant"), gte(messages.createdAt, since), isNotNull(messages.metadata)))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const events: RetrievalEvent[] = [];
  for (const row of rows) {
    const ev = eventFromMetadata(row.metadata);
    if (ev) events.push(ev);
  }
  return computeRetrievalAnalytics(events);
}
