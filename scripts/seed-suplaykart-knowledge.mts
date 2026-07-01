/**
 * Suplaykart Brain seed — PREPARED ONLY (Phase 5). Every fact is sourced from the
 * database (Haji Businesses, Haji Core Profile). Nothing invented — no revenue,
 * no vendor lists, no delivery metrics.
 *
 * DRY RUN by default (shows content). Pass --apply to ingest into "suplaykart".
 * Run: npx tsx scripts/seed-suplaykart-knowledge.mts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")) {
  const t = l.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  const k = t.slice(0, i).trim(); const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[k]) process.env[k] = v;
}
interface Doc { title: string; category: string; content: string }

export const SUPLAYKART_DOCS: Doc[] = [
  {
    title: "Suplaykart — Company Overview",
    category: "company",
    content:
`SUPLAYKART — COMPANY OVERVIEW

Company: Suplaykart
Founder & CEO: Syed Hasan Kuddos Sahib (Haji)
Founded: 01 January 2025
Business Type: Hyperlocal Commerce Platform
Service Area: Nagore and nearby locations
Status: Temporarily closed from 01 June 2026; planned reopening 01 January 2027.

Mission: Bring modern hyperlocal commerce to Nagore.
Vision: Become the most trusted local commerce platform in Tamil Nadu.`,
  },
  {
    title: "Suplaykart — Business Model",
    category: "business-model",
    content:
`SUPLAYKART — BUSINESS MODEL

Suplaykart is a hyperlocal commerce platform for Nagore. Its concept combines the
models of Blinkit, Zepto and Zomato — fast local delivery of everyday goods and
restaurant orders for a single town and its nearby locations.

Service area: Nagore and nearby locations.`,
  },
  {
    title: "Suplaykart — Product Categories",
    category: "catalog",
    content:
`SUPLAYKART — PRODUCT CATEGORIES

Suplaykart delivers across the following categories:
- FMCG
- Groceries
- Bakery
- Restaurant Delivery
- Medicines
- Daily Essentials`,
  },
  {
    title: "Suplaykart — Operations",
    category: "operations",
    content:
`SUPLAYKART — OPERATIONS

Business type: Hyperlocal commerce platform.
Service area: Nagore and nearby locations.
Current status: Temporarily closed from 01 June 2026; planned reopening
01 January 2027.

Operational details such as delivery workflow, fulfilment process, staffing,
vendor onboarding, commission structure and unit economics have not yet been
formally documented in the knowledge base.`,
  },
  {
    title: "Suplaykart — Future Roadmap",
    category: "roadmap",
    content:
`SUPLAYKART — FUTURE ROADMAP

Suplaykart is temporarily closed from 01 June 2026, with a planned relaunch on
01 January 2027.

One-year goal (per the founder): successfully relaunch and stabilize Suplaykart.
Vision: become the most trusted local commerce platform in Tamil Nadu.`,
  },
];

// NOTE: "Vendor Network" is intentionally NOT drafted — no vendor data exists in
// the knowledge base. Provide vendor names/onboarding facts to add it.

const apply = process.argv.includes("--apply");
console.log(`Suplaykart seed — ${SUPLAYKART_DOCS.length} documents (Vendor Network omitted — no data):\n`);
for (const d of SUPLAYKART_DOCS) {
  console.log(`══ ${d.title} [${d.category}] ══`);
  console.log(d.content);
  console.log();
}
if (!apply) { console.log("DRY RUN — nothing written. Review above. Re-run with --apply to ingest into suplaykart."); process.exit(0); }

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL!);
const [brain] = await sql`SELECT id FROM brains WHERE slug='suplaykart'`;
const [owner] = await sql`SELECT "userId" AS uid FROM knowledge_document WHERE status='active' GROUP BY "userId" ORDER BY COUNT(*) DESC LIMIT 1`;
const { ingestText } = await import("../lib/knowledge/ingest.ts");
let ok = 0;
for (const d of SUPLAYKART_DOCS) {
  const res = await ingestText(owner.uid, { title: d.title, content: d.content, brainId: brain.id, visibility: "global", category: d.category });
  if ("ok" in res && res.ok) { ok++; console.log(`✅ ${d.title} (${res.chunks} chunks)`); } else console.error(`❌ ${d.title}`);
}
console.log(`\nIngested ${ok}/${SUPLAYKART_DOCS.length}.`);
