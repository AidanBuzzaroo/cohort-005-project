import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "~/db/schema";
import { bookmarks, courses, lessons, modules, notes } from "~/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

export const noteBodySchema = z
  .string()
  .trim()
  .max(2000, "Note must be 2,000 characters or fewer.");

export function getBookmark(db: Db, userId: number, lessonId: number) {
  return db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId)))
    .get();
}

export function toggleBookmark(db: Db, userId: number, lessonId: number) {
  return db.transaction(
    (tx) => {
      const existing = getBookmark(tx, userId, lessonId);
      if (existing) {
        tx.delete(bookmarks).where(eq(bookmarks.id, existing.id)).run();
        return false;
      }
      tx.insert(bookmarks).values({ userId, lessonId }).run();
      return true;
    },
    { behavior: "immediate" }
  );
}

export function getNote(db: Db, userId: number, lessonId: number) {
  return db
    .select({ body: notes.body, updatedAt: notes.updatedAt })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
    .get();
}

export function saveNote(
  db: Db,
  userId: number,
  lessonId: number,
  body: string,
  now: Date
) {
  const parsed = noteBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Note must be 2,000 characters or fewer.",
    } as const;
  }
  db.insert(notes)
    .values({
      userId,
      lessonId,
      body: parsed.data,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body: parsed.data, updatedAt: now.toISOString() },
    })
    .run();
  return { ok: true } as const;
}

const lessonRef = {
  lessonId: lessons.id,
  lessonTitle: lessons.title,
  moduleTitle: modules.title,
  courseTitle: courses.title,
  courseSlug: courses.slug,
};

export function getSavedForUser(db: Db, userId: number) {
  const savedBookmarks = db
    .select({ id: bookmarks.id, createdAt: bookmarks.createdAt, ...lessonRef })
    .from(bookmarks)
    .innerJoin(lessons, eq(bookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .all();
  const savedNotes = db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      ...lessonRef,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();
  return { savedBookmarks, savedNotes };
}
