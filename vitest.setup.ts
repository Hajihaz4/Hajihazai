import { config } from "dotenv";

// Load local secrets so DB-backed tests can reach Neon (skipped if absent).
config({ path: ".env.local" });
