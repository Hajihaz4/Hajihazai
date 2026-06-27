import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  admins,
  users,
  userProfiles,
  projects,
  knowledgeDocument,
  type Admin,
} from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/credential-queries";

/** Admin data layer. Admin identity is DB-driven (no ADMIN_EMAILS env). */

export async function countAdmins(): Promise<number> {
  const rows = await db.select({ id: admins.id }).from(admins);
  return rows.length;
}

export async function getAdminByUsername(username: string): Promise<Admin | null> {
  const [row] = await db.select().from(admins).where(eq(admins.username, username));
  return row ?? null;
}

/** Public-safe admin list (never returns password hashes). */
export async function listAdmins() {
  return db
    .select({
      id: admins.id,
      username: admins.username,
      createdAt: admins.createdAt,
      createdBy: admins.createdBy,
    })
    .from(admins)
    .orderBy(desc(admins.createdAt));
}

export async function createAdmin(input: {
  username: string;
  passwordHash: string;
  createdBy?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: "taken" }> {
  try {
    const [row] = await db
      .insert(admins)
      .values({
        username: input.username,
        passwordHash: input.passwordHash,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    return { ok: true, id: row.id };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "taken" };
    throw err;
  }
}

export async function deleteAdmin(id: string): Promise<boolean> {
  const [row] = await db.delete(admins).where(eq(admins.id, id)).returning();
  return !!row;
}

export async function resetAdminPassword(
  id: string,
  passwordHash: string,
): Promise<boolean> {
  const [row] = await db
    .update(admins)
    .set({ passwordHash })
    .where(eq(admins.id, id))
    .returning();
  return !!row;
}

/* ----------------------------- admin views ----------------------------- */

export async function adminListUsers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      username: userProfiles.username,
      createdAt: userProfiles.createdAt,
      lastLogin: userProfiles.lastLogin,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .orderBy(desc(userProfiles.createdAt));
}

export async function adminListProjects() {
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function adminListDocuments() {
  return db
    .select({
      id: knowledgeDocument.id,
      userId: knowledgeDocument.userId,
      projectId: knowledgeDocument.projectId,
      title: knowledgeDocument.title,
      sourceType: knowledgeDocument.sourceType,
      status: knowledgeDocument.status,
      createdAt: knowledgeDocument.createdAt,
    })
    .from(knowledgeDocument)
    .orderBy(desc(knowledgeDocument.createdAt));
}
