/**
 * Smart brain routing — classifies a chat message into the most relevant brain
 * using weighted keyword matching with small-typo (fuzzy) tolerance. No LLM call.
 *
 * Returns a decision object with a confidence score and the matched keywords.
 * When nothing matches, or the result is ambiguous (confidence below threshold),
 * brain is null — the caller then asks for clarification / answers without a
 * brain, instead of silently defaulting to haji-core.
 */

export interface RouteResult {
  /** Brain slug, or null when no confident brain could be chosen. */
  brain: string | null;
  /** 0–100 — the winning brain's share of matched weight. */
  confidence: number;
  /** The winning brain's matched keywords (fuzzy hits shown as "kw~token"). */
  matchedKeywords: string[];
  /** Human-readable explanation, surfaced in the admin debug panel. */
  reason: string;
}

export type BrainMode = "manual" | "smart";

/** Below this confidence we do NOT route (brain=null → clarify / no brain). */
export const CONFIDENCE_THRESHOLD = 55;

const BRAIN_RULES: Array<{ slug: string; keywords: readonly string[]; weight: number }> = [
  {
    slug: "legal",
    weight: 2,
    keywords: [
      // requested
      "article", "constitution", "constitutional", "judicial", "review",
      "basic structure", "doctrine", "bns", "bnss", "bsa", "ipc", "crpc",
      "evidence", "contract", "law",
      // existing (retained)
      "legal", "llb", "case law", "statute", "court", "judge", "plaintiff",
      "defendant", "section", "act", "legislation", "jurisdiction", "precedent",
      "tort", "criminal", "civil", "exam", "srm school of law", "penal",
      "fundamental rights", "writ", "petition", "amendment",
    ],
  },
  {
    slug: "allbee",
    weight: 2,
    keywords: [
      // requested
      "allbee", "alim", "agency", "digital marketing", "branding",
      "website development", "software solutions",
      // existing (retained)
      "all bee", "client", "website", "web design", "marketing", "digital",
      "seo", "campaign", "freelance", "development", "ecommerce", "ui", "ux",
      "portfolio", "proposal", "cfo",
    ],
  },
  {
    slug: "suplaykart",
    weight: 2,
    keywords: [
      // requested
      "suplaykart", "delivery", "grocery", "hyperlocal", "vendor", "shop",
      "inventory", "orders", "revenue",
      // existing (retained)
      "supplier", "fmcg", "saas", "b2b", "logistics", "supply chain", "product",
      "category", "retailer", "purchase order", "procurement", "order", "store",
      "blinkit", "zepto", "zomato",
    ],
  },
  {
    slug: "haji-core",
    weight: 1,
    keywords: [
      // requested
      "haji", "family", "mother", "father", "friend", "education", "college",
      "goal", "personality",
      // existing (retained) — incl. family members so name lookups still route
      "personal", "nagore", "study", "studies", "university", "goals", "friends",
      "hobby", "hobbies", "birthday", "born", "home", "religion", "identity",
      "life", "relationship", "girlfriend", "safina", "safina thangam", "hamza",
      "sahabuddin", "hidhayaa", "shehnaz", "hussain sahib", "kabeer",
      "family tree", "sister", "aunt", "cousin", "uncle", "grandfather",
      "grandmother", "paternal", "maternal", "relative",
    ],
  },
];

/** Levenshtein edit distance (small strings). */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** A query token fuzzy-matches a single-word keyword (small typo tolerance). */
function fuzzyMatches(token: string, kw: string): boolean {
  if (token.length < 4 || kw.length < 4) return false;
  if (Math.abs(token.length - kw.length) > 1) return false;
  return editDistance(token, kw) === 1;
}

export function routeToBrain(message: string): RouteResult {
  const lower = message.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);

  const per: Record<string, { score: number; matched: string[] }> = {};
  for (const rule of BRAIN_RULES) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of rule.keywords) {
      if (kw.includes(" ")) {
        if (lower.includes(kw)) { score += rule.weight; matched.push(kw); }
        continue;
      }
      // single-word: exact (word boundary) → full weight
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (re.test(lower)) { score += rule.weight; matched.push(kw); continue; }
      // else small-typo fuzzy → reduced weight (+1), flagged
      const fz = tokens.find((t) => fuzzyMatches(t, kw));
      if (fz) { score += 1; matched.push(`${kw}~${fz}`); }
    }
    if (score > 0) per[rule.slug] = { score, matched };
  }

  const ranked = Object.entries(per).sort(([, a], [, b]) => b.score - a.score);
  if (ranked.length === 0) {
    return { brain: null, confidence: 0, matchedKeywords: [], reason: "No brain keywords matched — clarify or answer without a brain." };
  }

  const [topSlug, top] = ranked[0];
  const secondScore = ranked[1]?.[1].score ?? 0;
  const confidence = Math.round((top.score / (top.score + secondScore)) * 100);

  if (confidence < CONFIDENCE_THRESHOLD) {
    const tied = ranked.filter(([, v]) => v.score === top.score).map(([s]) => s);
    return { brain: null, confidence, matchedKeywords: top.matched, reason: `Ambiguous between ${tied.join(" / ")} (confidence ${confidence}% < ${CONFIDENCE_THRESHOLD}%) — clarify.` };
  }

  return { brain: topSlug, confidence, matchedKeywords: top.matched, reason: `Matched ${topSlug}: ${top.matched.join(", ")}` };
}
