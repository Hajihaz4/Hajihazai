import { MODEL_REGISTRY, type ModelEntry } from "./registry";
import { providers } from "./providers";

/**
 * SERVER ONLY. Returns the models whose provider is actually usable in the
 * current environment (reads process.env via provider.isAvailable()).
 *
 * On Vercel (production, no OLLAMA_BASE_URL) the local Ollama model is hidden,
 * so users never see — or accidentally select — a model that will only fall
 * back. Never returns an empty list (degrades to all enabled models).
 *
 * Do NOT import this from a Client Component — it would leak env logic to the
 * bundle. Compute it in a Server Component and pass the result down as a prop.
 */
export function listAvailableModels(): ModelEntry[] {
  const available = MODEL_REGISTRY.filter(
    (m) => m.enabled && providers[m.provider]?.isAvailable(),
  );
  return available.length > 0
    ? available
    : MODEL_REGISTRY.filter((m) => m.enabled);
}
