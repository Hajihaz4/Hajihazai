import { z } from "zod";
import type { Tool } from "./types";
import { ToolError } from "./types";

export const CALCULATOR_MAX_CHARS = 200;

/**
 * Safe arithmetic evaluator — NO eval / Function. Supports + - * / and
 * parentheses over decimal numbers, via a small recursive-descent parser
 * (tokenize → shunting-yard-free recursive grammar). Deterministic.
 *
 * Grammar:
 *   expr   = term (("+" | "-") term)*
 *   term   = factor (("*" | "/") factor)*
 *   factor = number | "(" expr ")" | ("+" | "-") factor
 */

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lp" }
  | { type: "rp" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lp" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rp" });
      i++;
      continue;
    }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i;
      let dots = 0;
      while (j < input.length && ((input[j] >= "0" && input[j] <= "9") || input[j] === ".")) {
        if (input[j] === ".") dots++;
        j++;
      }
      const slice = input.slice(i, j);
      if (dots > 1) throw new ToolError(`Invalid number: ${slice}`, "invalid_input");
      tokens.push({ type: "num", value: Number(slice) });
      i = j;
      continue;
    }
    throw new ToolError(`Unexpected character: ${ch}`, "invalid_input");
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): number {
    const value = this.expr();
    if (this.pos !== this.tokens.length) {
      throw new ToolError("Unexpected trailing input", "invalid_input");
    }
    return value;
  }

  private expr(): number {
    let value = this.term();
    let t = this.peek();
    while (t && t.type === "op" && (t.value === "+" || t.value === "-")) {
      this.next();
      const rhs = this.term();
      value = t.value === "+" ? value + rhs : value - rhs;
      t = this.peek();
    }
    return value;
  }

  private term(): number {
    let value = this.factor();
    let t = this.peek();
    while (t && t.type === "op" && (t.value === "*" || t.value === "/")) {
      this.next();
      const rhs = this.factor();
      if (t.value === "/" && rhs === 0) {
        throw new ToolError("Division by zero", "invalid_input");
      }
      value = t.value === "*" ? value * rhs : value / rhs;
      t = this.peek();
    }
    return value;
  }

  private factor(): number {
    const t = this.peek();
    if (!t) throw new ToolError("Unexpected end of expression", "invalid_input");

    if (t.type === "op" && (t.value === "+" || t.value === "-")) {
      this.next();
      const v = this.factor();
      return t.value === "-" ? -v : v;
    }
    if (t.type === "num") {
      this.next();
      return t.value;
    }
    if (t.type === "lp") {
      this.next();
      const v = this.expr();
      const close = this.next();
      if (!close || close.type !== "rp") {
        throw new ToolError("Missing closing parenthesis", "invalid_input");
      }
      return v;
    }
    throw new ToolError("Unexpected token", "invalid_input");
  }
}

export function evaluateExpression(expression: string): number {
  if (typeof expression !== "string" || !expression.trim()) {
    throw new ToolError("expression must be a non-empty string", "invalid_input");
  }
  const tokens = tokenize(expression);
  if (tokens.length === 0) {
    throw new ToolError("Empty expression", "invalid_input");
  }
  const result = new Parser(tokens).parse();
  if (!Number.isFinite(result)) {
    throw new ToolError("Result is not a finite number", "invalid_input");
  }
  return result;
}

export const calculatorTool: Tool = {
  name: "calculator",
  description:
    "Evaluate a basic arithmetic expression (+ - * / and parentheses). Input: { expression: string }.",
  inputSchema: z.object({
    expression: z
      .string()
      .min(1, "expression is required")
      .max(CALCULATOR_MAX_CHARS, `expression must be ≤ ${CALCULATOR_MAX_CHARS} characters`),
  }),
  async execute(_userId, input) {
    const expression = (input as { expression?: unknown })?.expression;
    if (typeof expression !== "string") {
      throw new ToolError("input.expression must be a string", "invalid_input");
    }
    return { result: evaluateExpression(expression) };
  },
};
