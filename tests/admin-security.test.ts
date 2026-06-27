import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { scryptSync, randomBytes } from "node:crypto";
import { verifyPassword } from "@/lib/auth/password";

/** Fix #1 — admin creation must NOT be possible for the public. */
describe("admin security", () => {
  it("removes the public bootstrap/initialize-admin endpoint", () => {
    expect(existsSync("app/api/admin/bootstrap/route.ts")).toBe(false);
  });

  it("guards every admin management route with requireAdmin", () => {
    for (const f of [
      "app/api/admin/admins/route.ts",
      "app/api/admin/admins/[id]/route.ts",
      "app/api/admin/data/route.ts",
    ]) {
      expect(readFileSync(f, "utf8")).toContain("requireAdmin");
    }
  });

  it("removes the 'initialize first admin' path from the portal UI", () => {
    const ui = readFileSync("components/admin-portal.tsx", "utf8");
    expect(ui).not.toContain("bootstrap");
    expect(ui.toLowerCase()).not.toContain("initialize admin");
  });

  it("ships a trusted seed script for the first admin", () => {
    expect(existsSync("scripts/seed-admin.mjs")).toBe(true);
    expect(readFileSync("package.json", "utf8")).toContain("seed:admin");
  });

  it("a seed-script scrypt hash verifies against the app's verifyPassword", async () => {
    // Must match lib/auth/password.ts format: scrypt:<saltHex>:<keyHex>, keylen 64.
    const salt = randomBytes(16).toString("hex");
    const hash = `scrypt:${salt}:${scryptSync("SeedPass123", salt, 64).toString("hex")}`;
    expect(await verifyPassword("SeedPass123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
