/**
 * AllBee Brain seed — the six approved AllBee documents. Every fact is sourced
 * from the database, the repo, or facts explicitly confirmed by the owner.
 * Nothing invented (no client counts, revenue, team sizes, pricing, outcomes).
 *
 * DRY RUN by default. Pass --apply to ingest into the "allbee" brain (global).
 * Run: npx tsx scripts/seed-allbee-knowledge.mts [--apply]
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

export const ALLBEE_DOCS: Doc[] = [
  {
    title: "AllBee — Company Overview",
    category: "company",
    content:
`ALLBEE SOLUTIONS — COMPANY OVERVIEW

Company: AllBee Solutions
Founded: 2025
Industry: Digital Solutions and Technology Services
Founder & CEO: Mohamed Backer Alim Sahib
Co-Founder & CFO: Syed Hasan Kuddos Sahib (Haji)

AllBee Solutions is a digital solutions and technology services company that
helps businesses grow using technology and digital transformation.`,
  },
  {
    title: "AllBee — Founders",
    category: "company",
    content:
`ALLBEE SOLUTIONS — FOUNDERS

Mohamed Backer Alim Sahib
Role: Founder and CEO
Ownership: 70%

Syed Hasan Kuddos Sahib (Haji)
Role: Co-Founder and Chief Financial Officer (CFO)
Ownership: 30%

AllBee Solutions was established in 2025 as a digital solutions and technology
services company focused on helping businesses grow through technology and
digital transformation.`,
  },
  {
    title: "AllBee — Services",
    category: "services",
    content:
`ALLBEE SOLUTIONS — SERVICES

AllBee Solutions provides the following services:
- Website Development
- Digital Marketing
- Branding
- Social Media Management
- Training Programs
- Software Solutions`,
  },
  {
    title: "AllBee — Operations",
    category: "operations",
    content:
`ALLBEE SOLUTIONS — OPERATIONS

Business type: Digital Solutions and Technology Services company.

Core service areas: Website Development, Digital Marketing, Branding,
Social Media Management, Training Programs, Software Solutions.

Leadership:
- Mohamed Backer Alim Sahib — Founder
- Syed Hasan Kuddos Sahib (Haji) — Co-Founder and CFO

Operational details such as team structure, client onboarding process, project
delivery workflow, SLAs, staffing model, and internal processes have not yet
been formally documented in the knowledge base.`,
  },
  {
    title: "AllBee — Vision & Mission",
    category: "company",
    content:
`ALLBEE SOLUTIONS — VISION & MISSION

Mission: Help businesses grow using technology and digital transformation.
Vision: Become a leading technology and digital growth company.`,
  },
  {
    title: "AllBee — Projects Inventory",
    category: "projects",
    content:
`ALLBEE SOLUTIONS — PROJECTS INVENTORY

1. HajiHaz AI
   An AI assistant platform — "Next-generation AI assistant platform powered by
   memory, retrieval, and multi-model intelligence." Built with Next.js, React,
   Drizzle ORM and Neon Postgres; deployed on Vercel at
   hajihazai.allbeesolutions.com. Status: active development.

2. AllBee Website
   AllBee Solutions' own company website.

3. Suplaykart — Coming Soon
   Coming-soon site for Suplaykart. (Suplaykart is temporarily closed from
   01 June 2026, with a planned reopening on 01 January 2027.)

4. Suplaykart Platform
   The Suplaykart hyperlocal commerce platform for Nagore — modelled on Blinkit,
   Zepto and Zomato; categories include FMCG, Groceries, Bakery, Restaurant
   Delivery, Medicines and Daily Essentials.

Note: client names, revenue, delivery dates, outcomes and team assignments are
not yet recorded.`,
  },
];

const apply = process.argv.includes("--apply");
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL!);
const [allbee] = await sql`SELECT id FROM brains WHERE slug='allbee'`;
const [owner] = await sql`SELECT "userId" AS uid FROM knowledge_document WHERE status='active' GROUP BY "userId" ORDER BY COUNT(*) DESC LIMIT 1`;
const [existing] = await sql`SELECT COUNT(*)::int AS n FROM knowledge_document WHERE brain_id=${allbee?.id} AND status='active'`;

console.log(`allbee brain: ${allbee?.id ?? "MISSING"} | owner: ${owner?.uid?.slice(0,12) ?? "?"} | existing allbee docs: ${existing.n}`);
ALLBEE_DOCS.forEach((d, i) => console.log(`  ${i + 1}. [${d.category}] ${d.title} (${d.content.length} chars)`));

if (!apply) { console.log("\nDRY RUN — nothing written. Re-run with --apply to ingest."); process.exit(0); }
if (existing.n > 0) { console.error(`\n✋ allbee already has ${existing.n} docs — refusing to double-ingest. Clear first if re-seeding.`); process.exit(1); }

const { ingestText } = await import("../lib/knowledge/ingest.ts");
let ok = 0;
for (const d of ALLBEE_DOCS) {
  const res = await ingestText(owner.uid, { title: d.title, content: d.content, brainId: allbee.id, visibility: "global", category: d.category });
  if ("ok" in res && res.ok) { ok++; console.log(`  ✅ ${d.title} (${res.chunks} chunks)`); }
  else console.error(`  ❌ ${d.title}: ${(res as { error: string }).error}`);
}
console.log(`\nIngested ${ok}/${ALLBEE_DOCS.length} AllBee documents.`);
