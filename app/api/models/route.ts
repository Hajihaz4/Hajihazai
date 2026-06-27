import { auth } from "@/auth";
import { probeAll } from "@/lib/ai/health";
import { listLevels, defaultLevel } from "@/lib/ai/levels";

/**
 * Returns the capability levels that are currently healthy, for the model
 * selector. Runs cooldown-guarded health probes so decommissioned models /
 * invalid keys are hidden. No provider names or failure details are exposed.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  await probeAll();
  const levels = listLevels();
  return Response.json({ levels, default: defaultLevel() });
}
