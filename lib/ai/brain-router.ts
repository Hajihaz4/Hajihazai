/**
 * Smart brain routing — classifies a chat message into the most relevant brain
 * using keyword matching. No LLM call; runs in microseconds.
 *
 * Returns the brain slug that best matches the message, or "haji-core" as the
 * default. Callers look up the actual brain ID from the slug.
 */

const BRAIN_RULES: Array<{
  slug: string;
  keywords: readonly string[];
  weight?: number;
}> = [
  {
    slug: "legal",
    keywords: [
      "law", "legal", "llb", "constitution", "constitutional", "contract",
      "company law", "case law", "statute", "court", "judge", "plaintiff",
      "defendant", "section", "article", "act", "legislation", "jurisdiction",
      "precedent", "tort", "criminal", "civil", "exam", "srm school of law",
    ],
    weight: 2,
  },
  {
    slug: "suplaykart",
    keywords: [
      "suplaykart", "supplier", "vendor", "fmcg", "delivery", "grocery",
      "saas", "b2b", "inventory", "logistics", "supply chain", "product",
      "category", "retailer", "purchase order", "procurement",
    ],
    weight: 2,
  },
  {
    slug: "allbee",
    keywords: [
      "allbee", "all bee", "client", "website", "web design", "marketing",
      "agency", "digital", "seo", "campaign", "freelance", "development",
      "ecommerce", "ui", "ux", "portfolio", "proposal",
    ],
    weight: 2,
  },
  {
    slug: "haji-core",
    keywords: [
      "haji", "personal", "family", "mother", "father", "nagore", "education",
      "study", "studies", "college", "university", "goal", "goals", "friend",
      "friends", "hobby", "hobbies", "birthday", "born", "home", "religion",
      "identity", "life", "relationship", "girlfriend",
    ],
    weight: 1,
  },
];

function matchesKeyword(text: string, kw: string): boolean {
  // Multi-word phrases use substring match; single words require word boundaries.
  if (kw.includes(" ")) return text.includes(kw);
  const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  return re.test(text);
}

export function routeToBrain(message: string): string {
  const lower = message.toLowerCase();

  const scores: Record<string, number> = {};
  for (const rule of BRAIN_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (matchesKeyword(lower, kw)) score += (rule.weight ?? 1);
    }
    if (score > 0) scores[rule.slug] = (scores[rule.slug] ?? 0) + score;
  }

  if (Object.keys(scores).length === 0) return "haji-core";

  // Return the slug with the highest score.
  return Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0];
}

export type BrainMode = "manual" | "smart";
