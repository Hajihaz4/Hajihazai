import { describe, it, expect } from "vitest";
import { exportToolSpecs, toToolDefinitions } from "@/lib/tools/specs";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("tool definitions derived from Zod (single source of truth)", () => {
  it("exposes all four tools as native definitions", () => {
    const defs = toToolDefinitions();
    expect(defs.map((d) => d.name).sort()).toEqual([
      "calculator",
      "current_time",
      "knowledge_search",
      "memory_search",
    ]);
  });

  it("each definition has a JSON-schema 'parameters' object", () => {
    for (const d of toToolDefinitions()) {
      expect((d.parameters as any).type).toBe("object");
      expect(typeof d.description).toBe("string");
    }
  });

  it("derives the calculator 200-char limit into the schema", () => {
    const calc = toToolDefinitions().find((d) => d.name === "calculator")!;
    const props = (calc.parameters as any).properties;
    expect(props.expression.type).toBe("string");
    expect(props.expression.maxLength).toBe(200);
  });

  it("derives the 500-char query limit for memory + knowledge search", () => {
    const mem = toToolDefinitions().find((d) => d.name === "memory_search")!;
    const know = toToolDefinitions().find((d) => d.name === "knowledge_search")!;
    expect((mem.parameters as any).properties.query.maxLength).toBe(500);
    expect((know.parameters as any).properties.query.maxLength).toBe(500);
  });

  it("marks required fields in the derived schema", () => {
    const calc = toToolDefinitions().find((d) => d.name === "calculator")!;
    expect((calc.parameters as any).required).toContain("expression");
  });

  it("specs and native definitions stay in sync (same source)", () => {
    const specNames = exportToolSpecs().map((s) => s.name).sort();
    const defNames = toToolDefinitions().map((d) => d.name).sort();
    expect(specNames).toEqual(defNames);
  });
});
