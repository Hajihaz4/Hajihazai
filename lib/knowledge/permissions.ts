import { isKnowledgeWritePermitted } from "@/lib/admin/queries";

export { isKnowledgeWritePermitted };

export async function assertKnowledgeWritePermission(email: string | null | undefined): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!email) return { ok: false, error: "Authentication required" };
  const permitted = await isKnowledgeWritePermitted(email);
  if (!permitted) {
    return { ok: false, error: "You do not have permission to update knowledge" };
  }
  return { ok: true };
}
