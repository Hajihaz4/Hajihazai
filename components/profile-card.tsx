"use client";

export interface ProfileCardData {
  fullName: string;
  preferredName: string;
  occupation: string;
  currentDegree: string;
  institution: string;
  location: string;
  businesses: string[];
  goals: string[];
  photoUrl?: string | null;
}

export function ProfileCard({ data }: { data: ProfileCardData }) {
  return (
    <div className="my-2 overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Header strip */}
      <div className="h-2 bg-gradient-to-r from-violet-500 to-indigo-500" />
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-2xl text-white shadow">
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photoUrl} alt={data.preferredName} className="size-14 rounded-full object-cover" />
            ) : (
              data.preferredName[0]?.toUpperCase() ?? "H"
            )}
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-base font-semibold">{data.preferredName}</h3>
              <span className="text-xs text-muted-foreground">{data.fullName}</span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{data.occupation}</p>
            <p className="text-xs text-muted-foreground">{data.location}</p>
          </div>
        </div>

        {/* Education */}
        <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Education
          </p>
          <p className="mt-0.5 text-sm font-medium">{data.currentDegree}</p>
          <p className="text-xs text-muted-foreground">{data.institution}</p>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {/* Businesses */}
          {data.businesses.length > 0 && (
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Businesses
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {data.businesses.map((b) => (
                  <li key={b} className="flex items-center gap-1 text-xs">
                    <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Goals */}
          {data.goals.length > 0 && (
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Goals
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {data.goals.map((g) => (
                  <li key={g} className="flex items-center gap-1 text-xs">
                    <span className="size-1.5 rounded-full bg-violet-500 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Returns true if the message is asking for a personal profile card. */
export function isProfileCardQuery(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return (
    /^who (is|are) haji/i.test(lower) ||
    /^(tell me |)about haji/i.test(lower) ||
    /^introduce haji/i.test(lower) ||
    /^(show|give) (me |)(haji('s|s)? )?profile/i.test(lower) ||
    lower === "haji" ||
    /^haji (who|info|details|profile)/i.test(lower)
  );
}

/** Default profile data — overridden if knowledge base data is available. */
export const DEFAULT_PROFILE: ProfileCardData = {
  fullName: "Syed Hasan Kuddos Sahib",
  preferredName: "Haji",
  occupation: "Entrepreneur & Law Student",
  currentDegree: "LLB (Hons)",
  institution: "SRM School of Law, SRM Institute of Science and Technology",
  location: "Chennai, Tamil Nadu, India",
  businesses: ["Suplaykart (B2B FMCG SaaS)", "AllBee Solutions (Digital Agency)"],
  goals: [
    "Relaunch and stabilise Suplaykart",
    "Become a Corporate Lawyer",
    "Build a lasting legacy",
  ],
};
