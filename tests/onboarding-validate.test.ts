import { describe, it, expect } from "vitest";
import {
  validateUsername,
  validateCountryCode,
  validateMobile,
} from "@/lib/onboarding/validate";

describe("validateUsername", () => {
  it("accepts valid usernames", () => {
    expect(validateUsername("haji_99")).toEqual({ ok: true, value: "haji_99" });
    expect(validateUsername("  Abc  ").ok).toBe(true); // trims
  });
  it("rejects too short / too long", () => {
    expect(validateUsername("ab").ok).toBe(false);
    expect(validateUsername("a".repeat(31)).ok).toBe(false);
  });
  it("rejects invalid characters", () => {
    expect(validateUsername("haji-99").ok).toBe(false);
    expect(validateUsername("haji 99").ok).toBe(false);
    expect(validateUsername("haji.99").ok).toBe(false);
  });
  it("rejects non-strings", () => {
    expect(validateUsername(undefined).ok).toBe(false);
    expect(validateUsername(123).ok).toBe(false);
  });
});

describe("validateCountryCode", () => {
  it("accepts dial codes", () => {
    expect(validateCountryCode("+91").ok).toBe(true);
    expect(validateCountryCode("+1").ok).toBe(true);
    expect(validateCountryCode("+971").ok).toBe(true);
  });
  it("rejects malformed codes", () => {
    expect(validateCountryCode("91").ok).toBe(false);
    expect(validateCountryCode("+").ok).toBe(false);
    expect(validateCountryCode("++91").ok).toBe(false);
  });
});

describe("validateMobile", () => {
  it("accepts and normalizes digits", () => {
    expect(validateMobile("98765 43210")).toEqual({ ok: true, value: "9876543210" });
    expect(validateMobile("(987) 654-3210").ok).toBe(true);
  });
  it("rejects non-numeric / wrong length", () => {
    expect(validateMobile("12345").ok).toBe(false); // too short
    expect(validateMobile("abcdefgh").ok).toBe(false);
    expect(validateMobile("1".repeat(16)).ok).toBe(false);
  });
});
