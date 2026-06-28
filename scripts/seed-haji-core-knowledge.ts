/**
 * Seeds 6 focused Haji Core knowledge documents.
 * Also assigns brain_id to the original profile doc so it participates in
 * brain-scoped retrieval properly.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-haji-core-knowledge.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { knowledgeDocument } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ingestText } from "@/lib/knowledge/ingest";
import { getBrainBySlug } from "@/lib/db/brain-queries";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";

/* ─── Document content ──────────────────────────────────────────────────── */

const DOCS: Array<{ title: string; category: string; content: string }> = [
  {
    title: "Haji Identity",
    category: "Personal",
    content: `HAJI — IDENTITY

Full Name: Syed Hasan Kuddos Sahib
Preferred Name: Haji
Nickname: Haji
Initial: S
Date of Birth: 29 March 2004
Age (as of 2026): 22 years old
Place of Birth: Nagapattinam, Tamil Nadu, India
Native Place: Nagore, Tamil Nadu, India
Current Location: Potheri, Kattankulathur, Chennai, Tamil Nadu, India
Religion: Islam
Languages: Tamil (Read, Write, Speak), English (Read, Write, Speak)

Occupation: Entrepreneur, Law Student, Investor
Summary: Haji is Syed Hasan Kuddos Sahib — an ambitious entrepreneur, law student and investor from Nagore, Tamil Nadu. He founded Suplaykart, co-founded AllBee Solutions, and is pursuing LLB (Hons) at SRM School of Law, Chennai.

Who is Haji? Haji is Syed Hasan Kuddos Sahib — entrepreneur, law student, investor and founder of Suplaykart. He is currently pursuing LLB (Hons) at SRM School of Law, Kattankulathur, Chennai.`,
  },
  {
    title: "Haji Family Tree",
    category: "Personal",
    content: `HAJI — FAMILY TREE

PARENTS

Father
Full Name: Syed Mohamed Hussain Sahib
Qualification: B.Com (Jamal Mohamed College, Tiruchirappalli), MBA (The New College, Chennai)
Occupation: Founder of RKN Associates (construction and interior solutions company)

Mother
Full Name: Shehnaz Nisha
Occupation: Housewife
Mother's Father (Maternal Grandfather): Syed Meeran Sahib, known as Sinna Kamil Sahib

SIBLINGS

Sister
Name: Hidhayaa
Status: Married on 06 June 2026

PATERNAL GRANDPARENTS (Father's Parents)

Paternal Grandfather
Name: Syed Hasan Kuddos Sahib
Note: Haji is named after his paternal grandfather.

Paternal Grandmother
Name: Syed Sultan Beevi, known as Seyyadamma

Step Grandfather (Father's Step Father)
Name: Shaha Syed Sahib

MATERNAL GRANDPARENTS (Mother's Parents)

Maternal Grandfather
Name: Syed Meeran Sahib, known as Sinna Kamil Sahib

Maternal Grandmother
Name: Syed Sultan Beevi, known as Biyama

RELATIVES — MOTHER'S SIDE

Maternal Aunt (Mother Shehnaz Nisha's Sister)
Name: Safina Thangam
Husband: Kabeer Sahib

Maternal Aunt Safina Thangam's Children (Haji's Cousins):
1. Mohammed Hamza Sahib
2. Sadath Nisa
3. Sahabuddin Sahib
Special Note: Haji has a very close bond with Sahabuddin Sahib since childhood. Sahabuddin is Haji's cousin.

Who is Safina Thangam? Safina Thangam is Haji's maternal aunt — the sister of Haji's mother Shehnaz Nisha. Safina Thangam is married to Kabeer Sahib. Their children are Mohammed Hamza Sahib, Sadath Nisa, and Sahabuddin Sahib.

Who is Haji's mother's sister? Haji's mother's sister is Safina Thangam. She is married to Kabeer Sahib and has three children: Mohammed Hamza Sahib, Sadath Nisa and Sahabuddin Sahib.

Who is Hamza? Mohammed Hamza Sahib is Haji's cousin. He is the son of Haji's maternal aunt Safina Thangam and Kabeer Sahib.

Who is Sahabuddin? Sahabuddin Sahib is Haji's cousin. He is the son of Haji's maternal aunt Safina Thangam and Kabeer Sahib. Haji has a very close bond with Sahabuddin since childhood.

Who is Hidhayaa? Hidhayaa is Haji's younger sister. She got married on 06 June 2026.

EXTENDED FAMILY

Aathika Sultani — Maternal Extended Cousin
Sister: Ummahani
Mother: Fathim Johara Beevi
Father: Shahul Hameed (Imam associated with Nagore Dargah Mosque)

FAMILY TREE SUMMARY
- Father: Syed Mohamed Hussain Sahib
- Mother: Shehnaz Nisha
- Sister: Hidhayaa (married 06 June 2026)
- Paternal Grandfather: Syed Hasan Kuddos Sahib (Haji is named after him)
- Paternal Grandmother: Syed Sultan Beevi (Seyyadamma)
- Maternal Grandfather: Syed Meeran Sahib (Sinna Kamil Sahib)
- Maternal Grandmother: Syed Sultan Beevi (Biyama)
- Maternal Aunt: Safina Thangam (mother Shehnaz Nisha's sister)
- Cousins from Aunt Safina: Mohammed Hamza Sahib, Sadath Nisa, Sahabuddin Sahib`,
  },
  {
    title: "Haji Education",
    category: "Education",
    content: `HAJI — EDUCATION

SCHOOL EDUCATION
School: Nagore Modern Matriculation Higher Secondary School
Location: Nagore, Tamil Nadu
Group: Commerce (Third Group)
10th Standard Completed: 2018
12th Standard Completed: 2020
Sports: Represented in Football at Zonal Level

UNDERGRADUATE EDUCATION
Degree: Bachelor of Business Administration (BBA)
Specialization: Financial Services
Institution: B.S. Abdur Rahman Crescent Institute of Science and Technology
Location: Vandalur, Chennai
Start Year: 2021
Completion Year: 2024
CGPA: 7.5
Certifications: AICPA & CIMA Digital Finance, AICPA & CIMA Budget and Cost Analysis, AICPA & CIMA Financial Reporting

CURRENT EDUCATION
Degree: LLB (Hons)
Institution: SRM School of Law
University: SRM Institute of Science and Technology
Location: Kattankulathur, Potheri, Chennai
Start Year: 2025
Expected Graduation: 2028
Favorite Subject: Company Law
Future Legal Interest: Corporate Law
Career Goal: Corporate Lawyer

Where is Haji studying? SRM School of Law, SRM Institute of Science and Technology, Kattankulathur, Chennai.
What did Haji study in UG? BBA in Financial Services from B.S. Abdur Rahman Crescent Institute of Science and Technology, Vandalur.`,
  },
  {
    title: "Haji Friends",
    category: "Personal",
    content: `HAJI — FRIENDS AND SOCIAL CIRCLE

CLOSEST FRIENDS

Azees
Relationship: Childhood friend, grew up in same street, also a family relative
Date of Birth: 11 May 2003

Ali
Relationship: Business Partner, Co-founder (AllBee Solutions)

Kaif
Relationship: Studied together from school until UG, currently based in Dubai

Abdul
Relationship: Childhood friend

CURRENT ROOMMATES
Selva and Sundar
Residence: VGN Southern Avenue, Potheri, Chennai

FRIENDS FROM CRESCENT UNIVERSITY (BBA)
Romita Venkatesan, Afisa Begum, Karishma (Married in 2026), Niyamathulla, Rashid, Jebihulla

OTHER FRIENDS
Salman — Friend, connected through Kaif

Who are Haji's closest friends? Azees, Ali, Kaif and Abdul.`,
  },
  {
    title: "Haji Businesses",
    category: "Business",
    content: `HAJI — BUSINESSES AND INVESTMENT PROFILE

SUPLAYKART
Role: Founder and CEO
Founded: 01 January 2025
Status: Temporarily Closed from 01 June 2026. Planned Reopening: 01 January 2027.
Business Type: Hyperlocal Commerce Platform
Concept: Combination of Blinkit, Zepto and Zomato — for Nagore
Service Area: Nagore and nearby locations
Categories: FMCG, Groceries, Bakery, Restaurant Delivery, Medicines, Daily Essentials
Mission: Bring modern hyperlocal commerce to Nagore.
Vision: Become the most trusted local commerce platform in Tamil Nadu.

ALLBEE SOLUTIONS
Role: Co-Founder and CFO
Ownership: 30%
Founded: 2025
Industry: Digital Solutions and Technology Services
Services: Website Development, Digital Marketing, Branding, Social Media Management, Training Programs, Software Solutions
Mission: Help businesses grow using technology and digital transformation.
Vision: Become a leading technology and digital growth company.

RKN ASSOCIATES
Role: Director of Strategy and Finance
Industry: Construction and Interior Solutions
Founder: Syed Mohamed Hussain Sahib (Haji's father)
Services: Stainless Steel Works, Interior Design, Architectural Solutions, Construction Support
Mission: Deliver quality engineering and interior solutions.
Vision: Build a trusted engineering brand across South India.

INVESTMENT PROFILE
Category: Investor and Trader
Interest Areas: Stock Market, Long-Term Investing, Business Growth, Entrepreneurship

TECHNICAL SKILLS
WordPress, HTML, CSS, React Fundamentals, Website Management, Hosting Management, Domain Management, GitHub Workflows, Vercel Deployments, Business Systems Design, Process Automation

BUSINESS SKILLS
Business Strategy, Financial Planning, Startup Operations, Digital Marketing, Team Coordination, Negotiation, Problem Solving, Business Development`,
  },
  {
    title: "Haji Goals and Personality",
    category: "Personal",
    content: `HAJI — GOALS, PERSONALITY AND PREFERENCES

GOALS
One-Year Goal: Successfully relaunch and stabilize Suplaykart.
Five-Year Goal: Become a successful Corporate Lawyer.
Ten-Year Goal: Build a legacy that surprises the world and makes Nagore proud.
Overall Goal: To build successful businesses, become a corporate lawyer and create a lasting impact.

PERSONALITY TRAITS
Ambitious, Entrepreneurial, Strategic, Growth-Oriented, Resilient, Practical, Curious, Long-Term Thinker

MENTORS
Primary Mentor: Allah
Secondary Mentor: Self-Learning and Personal Experience

PERSONAL PREFERENCES
Favorite Color: White
Favorite Sunglass Brands: Ray-Ban, David Beckham Eyewear
Favorite Clothing Brand: Andamen
Favorite Smartphone: iPhone
Favorite Car: Lexus
Favorite Foods: Biryani, Fried Rice

HOBBIES
Walking, Football, Cricket, PUBG, Building Businesses, Thinking About Systems, Entrepreneurship

IMPORTANT FACTS ABOUT HAJI
Haji prefers direct and practical answers.
Haji values long-term thinking.
Haji focuses heavily on business growth.
Haji is passionate about law and entrepreneurship.
Haji is currently focused on personal growth and building his future.
Haji is actively developing businesses, legal knowledge and technology systems.
Haji loves building systems that can operate at scale.
Haji's identity is strongly connected to Nagore, entrepreneurship, law and community development.

RELATIONSHIP STATUS
Haji is currently focused on personal growth, education, business and building his future. He is not currently pursuing a romantic relationship.`,
  },
];

/* ─── Main ──────────────────────────────────────────────────────────────── */

async function main() {
  const brain = await getBrainBySlug("haji-core");
  if (!brain) {
    console.error("haji-core brain not found — run migration 0015 first");
    process.exit(1);
  }
  const brainId = brain.id;
  console.log(`\nHaji Core brain_id: ${brainId}`);

  // Assign brain_id to the original profile document (if still null)
  const originalDocId = "093f7ec8-2aff-4c99-ae6d-d2648d089b5c";
  const updated = await db
    .update(knowledgeDocument)
    .set({ brainId })
    .where(eq(knowledgeDocument.id, originalDocId))
    .returning();
  if (updated.length > 0) {
    console.log(`✓ Original "Haji Core Profile V1.0" assigned to haji-core brain`);
  }

  // Assign brain_id to the College doc too
  const collegeDocId = "73fe1be5-73fe-4c9d-9267-4c32b87f1d67";
  await db.update(knowledgeDocument).set({ brainId }).where(eq(knowledgeDocument.id, collegeDocId));
  console.log(`✓ "College" doc assigned to haji-core brain`);

  // Ingest the 6 focused documents
  for (const doc of DOCS) {
    process.stdout.write(`\nIngesting "${doc.title}"...`);
    const result = await ingestText(HAJI_ID, {
      title: doc.title,
      content: doc.content,
      category: doc.category,
      projectId: null,
      brainId,
    });
    if (result.ok) {
      console.log(` ✓  ${result.chunks} chunk(s)  [${result.documentId}]`);
    } else {
      console.log(` ✗  ${result.error}`);
    }
  }

  console.log("\nDone. Verify retrieval with: npx tsx --env-file=.env.local scripts/haji-core-audit.ts");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
