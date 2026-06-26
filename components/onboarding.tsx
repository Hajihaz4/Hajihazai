"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

type Avail = "idle" | "checking" | "available" | "taken" | "invalid";

// A small, common set of country dial codes for the selector.
const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+81", label: "🇯🇵 +81" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+92", label: "🇵🇰 +92" },
];

export default function Onboarding({
  google,
}: {
  google: { name: string; email: string; picture: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [username, setUsername] = useState("");
  const [avail, setAvail] = useState<Avail>("idle");
  const [availMsg, setAvailMsg] = useState("");

  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time username availability (debounced, server-checked).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const u = username.trim();
    if (!u) {
      setAvail("idle");
      setAvailMsg("");
      return;
    }
    setAvail("checking");
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/username?u=${encodeURIComponent(u)}`);
        const data = await res.json();
        if (!data.valid) {
          setAvail("invalid");
          setAvailMsg(data.error ?? "Invalid username");
        } else if (data.available) {
          setAvail("available");
          setAvailMsg("Username is available");
        } else {
          setAvail("taken");
          setAvailMsg(data.error ?? "That username is taken");
        }
      } catch {
        setAvail("idle");
        setAvailMsg("");
      }
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), mobileNumber: mobile, countryCode }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        router.push("/");
        router.refresh();
        return;
      }
      setError(data.error ?? "Something went wrong");
      if (data.error && /username/i.test(data.error)) setStep(1);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  const canContinueStep1 = avail === "available";
  const canContinueStep2 = /^\d{6,15}$/.test(mobile.replace(/[\s()-]/g, ""));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        {google.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={google.picture} alt="" className="size-10 rounded-full" />
        ) : null}
        <div className="text-sm">
          <div className="font-medium">{google.name}</div>
          <div className="text-muted-foreground">{google.email}</div>
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Complete your profile
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Step {step} of 3</p>

      {/* Step 1 — username */}
      {step === 1 ? (
        <div className="space-y-3">
          <label className="text-sm font-medium">Choose a username</label>
          <div className="relative">
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full rounded-lg border bg-background px-3 py-2 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {avail === "checking" ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
              {avail === "available" ? <Check className="size-4 text-green-600" /> : null}
              {avail === "taken" || avail === "invalid" ? <X className="size-4 text-destructive" /> : null}
            </span>
          </div>
          <p
            className={`text-xs ${
              avail === "available"
                ? "text-green-600"
                : avail === "taken" || avail === "invalid"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {availMsg || "3–30 characters · letters, numbers, underscore"}
          </p>
          <button
            onClick={() => setStep(2)}
            disabled={!canContinueStep1}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      ) : null}

      {/* Step 2 — mobile + country selector */}
      {step === 2 ? (
        <div className="space-y-3">
          <label className="text-sm font-medium">Mobile number</label>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="rounded-lg border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              autoFocus
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="numeric"
              placeholder="9876543210"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Stored as {countryCode} {mobile.replace(/[\s()-]/g, "")}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canContinueStep2}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {/* Step 3 — review + complete */}
      {step === 3 ? (
        <div className="space-y-3">
          <div className="rounded-lg border p-4 text-sm">
            <Row label="Username" value={username.trim()} />
            <Row label="Mobile" value={`${countryCode} ${mobile.replace(/[\s()-]/g, "")}`} />
            <Row label="Email" value={google.email} />
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
            >
              Back
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? "Completing…" : "Complete Profile"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
