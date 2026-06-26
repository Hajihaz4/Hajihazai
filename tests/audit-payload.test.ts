import { describe, it, expect } from "vitest";
import {
  capAuditPayload,
  serializeAuditPayload,
  AUDIT_MAX_PAYLOAD_CHARS,
} from "@/lib/db/tool-queries";

describe("audit payload hardening", () => {
  it("stores small payloads verbatim with correct size", () => {
    const { stored, size } = capAuditPayload({ a: 1 });
    expect(stored).toEqual({ a: 1 });
    expect(size).toBe(JSON.stringify({ a: 1 }).length);
  });

  it("truncates oversized payloads but records true size", () => {
    const big = { x: "y".repeat(5000) };
    const { stored, size } = capAuditPayload(big);
    expect(size).toBeGreaterThan(AUDIT_MAX_PAYLOAD_CHARS);
    expect((stored as any)._truncated).toBe(true);
    expect((stored as any).preview.length).toBeLessThanOrEqual(200);
  });

  it("handles unserializable payloads without throwing", () => {
    const circular: any = {};
    circular.self = circular;
    expect(() => serializeAuditPayload(circular)).not.toThrow();
    expect(() => capAuditPayload(circular)).not.toThrow();
  });

  it("treats null/undefined as null", () => {
    expect(capAuditPayload(undefined).stored).toBeNull();
    expect(capAuditPayload(null).size).toBe(4); // "null"
  });
});
