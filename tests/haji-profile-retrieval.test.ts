import { describe, it, expect } from "vitest";
import { buildKnowledgeContext } from "@/lib/memory/context";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Haji Core Profile retrieval", () => {
  it("Who is Haji?", async () => {
    const k = await buildKnowledgeContext(HAJI_ID, { query: "Who is Haji?", projectId: null });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("Syed Hasan Kuddos Sahib");
  });

  it("Where is Haji studying?", async () => {
    const k = await buildKnowledgeContext(HAJI_ID, { query: "Where is Haji studying?", projectId: null });
    expect(k.block).toContain("SRM School of Law");
  });

  it("What businesses does Haji run?", async () => {
    const k = await buildKnowledgeContext(HAJI_ID, { query: "What businesses does Haji run?", projectId: null });
    expect(k.block).toContain("Suplaykart");
  });

  it("Who are Haji's closest friends?", async () => {
    const k = await buildKnowledgeContext(HAJI_ID, { query: "Who are Haji's closest friends?", projectId: null });
    expect(k.block).toContain("Azees");
  });

  it("When was Haji born?", async () => {
    const k = await buildKnowledgeContext(HAJI_ID, { query: "When was Haji born?", projectId: null });
    expect(k.block).toContain("29 March 2004");
  });

  it("What is Haji's career goal?", async () => {
    const k = await buildKnowledgeContext(HAJI_ID, { query: "What is Haji career goal?", projectId: null });
    expect(k.block).toContain("Corporate Lawyer");
  });
});
