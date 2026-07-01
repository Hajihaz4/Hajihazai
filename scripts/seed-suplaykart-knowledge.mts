/**
 * Suplaykart Brain seed (Phase 2) — the 10 target documents. Every fact is
 * sourced from the database (Haji Businesses, Haji Core Profile). Where no data
 * exists, the document says so explicitly — NO invented revenue, metrics, vendor
 * lists, or policies.
 *
 * DRY RUN by default. Pass --apply to ingest into "suplaykart" (idempotent by
 * title). Run: npx tsx scripts/seed-suplaykart-knowledge.mts [--apply]
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
const UNKNOWN = "This information has not yet been recorded in the knowledge base and is intentionally left blank rather than guessed.";

export const SUPLAYKART_DOCS: Doc[] = [
  { title: "Suplaykart — Company Overview", category: "company", content:
`SUPLAYKART — COMPANY OVERVIEW

Company: Suplaykart
Founder & CEO: Syed Hasan Kuddos Sahib (Haji)
Founded: 01 January 2025
Business Type: Hyperlocal Commerce Platform
Service Area: Nagore and nearby locations
Status: Temporarily closed from 01 June 2026; planned reopening 01 January 2027.

Mission: Bring modern hyperlocal commerce to Nagore.
Vision: Become the most trusted local commerce platform in Tamil Nadu.` },
  { title: "Suplaykart — Founder & Leadership", category: "company", content:
`SUPLAYKART — FOUNDER & LEADERSHIP

Founder & CEO: Syed Hasan Kuddos Sahib (Haji).
Haji is an entrepreneur, law student and investor from Nagore; he founded
Suplaykart and co-founded AllBee Solutions.

Other leadership roles and team members: ${UNKNOWN}` },
  { title: "Suplaykart — Revenue Model", category: "business-model", content:
`SUPLAYKART — REVENUE MODEL

Suplaykart is a hyperlocal commerce platform (delivery of groceries, FMCG,
bakery, restaurant orders, medicines and daily essentials for Nagore).

Specific revenue streams, commission rates, delivery fees, margins and revenue
figures: ${UNKNOWN}` },
  { title: "Suplaykart — Vendor Onboarding", category: "operations", content:
`SUPLAYKART — VENDOR ONBOARDING

Suplaykart operates as a hyperlocal marketplace serving Nagore and nearby areas.

Vendor onboarding process, vendor list, eligibility criteria, agreements and
commission terms: ${UNKNOWN}` },
  { title: "Suplaykart — Delivery Operations", category: "operations", content:
`SUPLAYKART — DELIVERY OPERATIONS

Model: Hyperlocal delivery for Nagore and nearby locations, combining the models
of Blinkit, Zepto and Zomato (fast local delivery of everyday goods and
restaurant orders).

Delivery workflow, fulfilment process, delivery-partner model, timings and
service-level targets: ${UNKNOWN}` },
  { title: "Suplaykart — Product Categories", category: "catalog", content:
`SUPLAYKART — PRODUCT CATEGORIES

Suplaykart delivers across the following categories:
- FMCG
- Groceries
- Bakery
- Restaurant Delivery
- Medicines
- Daily Essentials` },
  { title: "Suplaykart — Customer Policies", category: "policies", content:
`SUPLAYKART — CUSTOMER POLICIES

Customer-facing policies (returns, refunds, cancellations, delivery guarantees,
support hours, complaint handling): ${UNKNOWN}` },
  { title: "Suplaykart — Expansion Plans", category: "roadmap", content:
`SUPLAYKART — EXPANSION PLANS

Suplaykart is temporarily closed from 01 June 2026, with a planned relaunch on
01 January 2027.
One-year goal (per the founder): successfully relaunch and stabilize Suplaykart.
Longer-term vision: become the most trusted local commerce platform in Tamil Nadu.

Specific city/area expansion targets and timelines beyond the Nagore relaunch:
${UNKNOWN}` },
  { title: "Suplaykart — Marketplace Structure", category: "business-model", content:
`SUPLAYKART — MARKETPLACE STRUCTURE

Suplaykart is a hyperlocal commerce platform for Nagore, modelled on Blinkit,
Zepto and Zomato — a single-town marketplace spanning grocery/FMCG delivery and
restaurant delivery.
Categories offered: FMCG, Groceries, Bakery, Restaurant Delivery, Medicines,
Daily Essentials.

Detailed marketplace mechanics (buyer/seller structure, listing model, catalog
management): ${UNKNOWN}` },
  { title: "Suplaykart — Business Vision", category: "company", content:
`SUPLAYKART — BUSINESS VISION

Mission: Bring modern hyperlocal commerce to Nagore.
Vision: Become the most trusted local commerce platform in Tamil Nadu.` },
];

const apply = process.argv.includes("--apply");
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL!);
const [brain] = await sql`SELECT id FROM brains WHERE slug='suplaykart'`;
const [owner] = await sql`SELECT "userId" AS uid FROM knowledge_document WHERE status='active' GROUP BY "userId" ORDER BY COUNT(*) DESC LIMIT 1`;
const existing = (await sql`SELECT title FROM knowledge_document WHERE brain_id=${brain.id} AND status='active'`).map((r) => r.title);

console.log(`suplaykart brain: ${brain.id} | ${SUPLAYKART_DOCS.length} target docs | existing: ${existing.length}\n`);
for (const d of SUPLAYKART_DOCS) console.log(`  ${existing.includes(d.title) ? "· (exists, skip)" : "+ (new)       "} ${d.title}`);

if (!apply) {
  console.log("\n── FULL CONTENT ──");
  for (const d of SUPLAYKART_DOCS) { console.log(`\n══ ${d.title} ══\n${d.content}`); }
  console.log("\nDRY RUN — nothing written. Re-run with --apply to ingest (skips existing titles).");
  process.exit(0);
}

const { ingestText } = await import("../lib/knowledge/ingest.ts");
let ok = 0;
for (const d of SUPLAYKART_DOCS) {
  if (existing.includes(d.title)) { console.log(`· skip (exists): ${d.title}`); continue; }
  const res = await ingestText(owner.uid, { title: d.title, content: d.content, brainId: brain.id, visibility: "global", category: d.category });
  if ("ok" in res && res.ok) { ok++; console.log(`✅ ${d.title} (${res.chunks} chunks)`); } else console.error(`❌ ${d.title}`);
}
console.log(`\nIngested ${ok} new documents.`);
