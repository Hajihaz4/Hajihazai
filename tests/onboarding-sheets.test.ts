import { describe, it, expect, vi, afterEach } from "vitest";
import { submitToSheet, type SheetPayload } from "@/lib/onboarding/sheets";

const PAYLOAD: SheetPayload = {
  username: "haji",
  email: "h@example.com",
  mobile: "9876543210",
  countryCode: "+91",
  googleName: "Haji",
  googleId: "sub-123",
  picture: "https://x/y.png",
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
});

describe("submitToSheet (best-effort, non-blocking)", () => {
  it("skips when no webhook URL is configured", async () => {
    delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    const fetchSpy = vi.spyOn(global, "fetch");
    const r = await submitToSheet(PAYLOAD);
    expect(r.skipped).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs the full payload as JSON when configured", async () => {
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = "https://script.example/exec";
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const r = await submitToSheet(PAYLOAD);
    expect(r.ok).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://script.example/exec");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(PAYLOAD);
  });

  it("does not throw when the webhook returns an error", async () => {
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = "https://script.example/exec";
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(submitToSheet(PAYLOAD)).resolves.toEqual({ ok: false });
  });

  it("does not throw when fetch itself rejects", async () => {
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = "https://script.example/exec";
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    await expect(submitToSheet(PAYLOAD)).resolves.toEqual({ ok: false });
  });
});
