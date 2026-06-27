import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  admins,
  users,
  userProfiles,
  projects,
  knowledgeDocument,
  knowledgeChunk,
  conversations,
  messages,
  userMemory,
  brains,
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

/** Knowledge documents enriched with user email and project name. */
export async function adminListKnowledge() {
  return db
    .select({
      id: knowledgeDocument.id,
      title: knowledgeDocument.title,
      category: knowledgeDocument.category,
      sourceType: knowledgeDocument.sourceType,
      status: knowledgeDocument.status,
      projectId: knowledgeDocument.projectId,
      projectName: projects.name,
      userId: knowledgeDocument.userId,
      userEmail: users.email,
      createdAt: knowledgeDocument.createdAt,
    })
    .from(knowledgeDocument)
    .leftJoin(projects, eq(projects.id, knowledgeDocument.projectId))
    .leftJoin(users, eq(users.id, knowledgeDocument.userId))
    .orderBy(desc(knowledgeDocument.createdAt));
}

/** Admin can delete any knowledge document (no ownership restriction). */
export async function adminDeleteKnowledge(documentId: string): Promise<boolean> {
  // Re-use the user-scoped helper by providing the actual owner — but since
  // admin has no userId, we do a direct admin-level delete instead.
  const [row] = await db
    .delete(knowledgeDocument)
    .where(eq(knowledgeDocument.id, documentId))
    .returning();
  return !!row;
}

/** All projects across all users, enriched with user email and isSystem flag. */
export async function adminListProjectsWithUsers() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      isSystem: projects.isSystem,
      userId: projects.userId,
      userEmail: users.email,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.userId))
    .orderBy(desc(projects.createdAt));
}

/**
 * Minimal project list for UI dropdowns — only id/name/userId so it works
 * even before migration 0014 (no is_system column selected).
 */
export async function adminListProjectsForPicker() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      userId: projects.userId,
    })
    .from(projects)
    .orderBy(projects.name);
}

/* ----------------------------- analytics ------------------------------- */

export interface AdminAnalytics {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalDocuments: number;
  totalChunks: number;
  totalBrains: number;
  totalMemories: number;
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const [
    [{ cnt: totalUsers }],
    [{ cnt: totalConversations }],
    [{ cnt: totalMessages }],
    [{ cnt: totalDocuments }],
    [{ cnt: totalChunks }],
    [{ cnt: totalBrains }],
    [{ cnt: totalMemories }],
  ] = await Promise.all([
    db.select({ cnt: count() }).from(users),
    db.select({ cnt: count() }).from(conversations),
    db.select({ cnt: count() }).from(messages),
    db.select({ cnt: count() }).from(knowledgeDocument),
    db.select({ cnt: count() }).from(knowledgeChunk),
    db.select({ cnt: count() }).from(brains),
    db.select({ cnt: count() }).from(userMemory),
  ]);

  return {
    totalUsers: Number(totalUsers),
    totalConversations: Number(totalConversations),
    totalMessages: Number(totalMessages),
    totalDocuments: Number(totalDocuments),
    totalChunks: Number(totalChunks),
    totalBrains: Number(totalBrains),
    totalMemories: Number(totalMemories),
  };
}

/* ----------------------------- brain admin ----------------------------- */

export async function adminListKnowledgeWithBrain() {
  return db
    .select({
      id: knowledgeDocument.id,
      title: knowledgeDocument.title,
      category: knowledgeDocument.category,
      sourceType: knowledgeDocument.sourceType,
      status: knowledgeDocument.status,
      projectId: knowledgeDocument.projectId,
      projectName: projects.name,
      brainId: knowledgeDocument.brainId,
      brainName: brains.name,
      brainIcon: brains.icon,
      userId: knowledgeDocument.userId,
      userEmail: users.email,
      createdAt: knowledgeDocument.createdAt,
    })
    .from(knowledgeDocument)
    .leftJoin(projects, eq(projects.id, knowledgeDocument.projectId))
    .leftJoin(brains, eq(brains.id, knowledgeDocument.brainId))
    .leftJoin(users, eq(users.id, knowledgeDocument.userId))
    .orderBy(desc(knowledgeDocument.createdAt));
}
