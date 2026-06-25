import { describe, it, expect } from "vitest";
import { evaluateExpression, calculatorTool } from "@/lib/tools/calculator";
import { ToolError } from "@/lib/tools/types";

describe("calculator (pure)", () => {
  it("does addition and subtraction left-to-right", () => {
    expect(evaluateExpression("2+3-1")).toBe(4);
  });

  it("does multiplication and division", () => {
    expect(evaluateExpression("8/2*3")).toBe(12);
  });

  it("respects operator precedence", () => {
    expect(evaluateExpression("2+3*4")).toBe(14);
  });

  it("respects parentheses", () => {
    expect(evaluateExpression("(2+3)*4")).toBe(20);
  });

  it("handles nested parentheses", () => {
    expect(evaluateExpression("((1+2)*(3+4))")).toBe(21);
  });

  it("handles unary minus / plus", () => {
    expect(evaluateExpression("-5 + 3")).toBe(-2);
    expect(evaluateExpression("+4 * -2")).toBe(-8);
  });

  it("handles decimals", () => {
    expect(evaluateExpression("0.1 + 0.2")).toBeCloseTo(0.3);
  });

  it("computes the spec examples", () => {
    expect(evaluateExpression("22 * 475000")).toBe(10_450_000);
    expect(evaluateExpression("(50000 + 70000) * 0.18")).toBeCloseTo(21_600);
  });

  it("throws on division by zero", () => {
    expect(() => evaluateExpression("1/0")).toThrow(ToolError);
  });

  it("throws on invalid characters", () => {
    expect(() => evaluateExpression("2 + a")).toThrow(ToolError);
  });

  it("throws on empty input", () => {
    expect(() => evaluateExpression("")).toThrow(ToolError);
    expect(() => evaluateExpression("   ")).toThrow(ToolError);
  });

  it("throws on unbalanced parentheses", () => {
    expect(() => evaluateExpression("(1+2")).toThrow(ToolError);
    expect(() => evaluateExpression("1+2)")).toThrow(ToolError);
  });

  it("is safe: does not evaluate code (no eval)", () => {
    expect(() => evaluateExpression("process.exit(1)")).toThrow(ToolError);
    expect(() => evaluateExpression("1; 2")).toThrow(ToolError);
  });

  it("tool wrapper returns { result }", async () => {
    expect(await calculatorTool.execute("u1", { expression: "2*5" })).toEqual({
      result: 10,
    });
  });

  it("tool wrapper rejects non-string expression", async () => {
    await expect(
      calculatorTool.execute("u1", { expression: 5 }),
    ).rejects.toThrow(ToolError);
  });
});
