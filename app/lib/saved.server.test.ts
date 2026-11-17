import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import {
  getBookmark,
  getNote,
  getSavedForUser,
  saveNote,
  toggleBookmark,
} from "./saved.server";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";

const NOW = new Date("2026-11-17T12:00:00.000Z");
let db: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db = createTestDb();
  base = seedBaseData(db);
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 1", position: 1 })
    .returning()
    .get().id;
});

afterEach(() => {
  vi.useRealTimers();
  db.$client.close();
});

it("refuses Notes over 2,000 characters without replacing the saved Note", () => {
  saveNote(db, base.user.id, lessonId, "Keep this", NOW);
  expect(saveNote(db, base.user.id, lessonId, "a".repeat(2001), NOW)).toEqual({
    ok: false,
    error: "Note must be 2,000 characters or fewer.",
  });
  expect(getNote(db, base.user.id, lessonId)?.body).toBe("Keep this");
});

it("saving a blank Note replaces its body and advances its last-edited time", () => {
  saveNote(db, base.user.id, lessonId, "Old thoughts", NOW);
  saveNote(
    db,
    base.user.id,
    lessonId,
    "   ",
    new Date("2026-11-17T13:00:00.000Z")
  );
  expect(getNote(db, base.user.id, lessonId)).toEqual({
    body: "",
    updatedAt: "2026-11-17T13:00:00.000Z",
  });
});

it("toggles a Bookmark on and off without duplicate Saved entries", () => {
  expect(getBookmark(db, base.user.id, lessonId)).toBeUndefined();
  expect(toggleBookmark(db, base.user.id, lessonId)).toBe(true);
  expect(getSavedForUser(db, base.user.id).savedBookmarks).toHaveLength(1);
  expect(toggleBookmark(db, base.user.id, lessonId)).toBe(false);
  expect(getBookmark(db, base.user.id, lessonId)).toBeUndefined();
  expect(getSavedForUser(db, base.user.id).savedBookmarks).toEqual([]);
  expect(toggleBookmark(db, base.user.id, lessonId)).toBe(true);
  expect(getSavedForUser(db, base.user.id).savedBookmarks).toHaveLength(1);
});

it("creates and replaces one plain-text Note with a new last-edited time", () => {
  expect(getNote(db, base.user.id, lessonId)).toBeUndefined();
  expect(
    saveNote(db, base.user.id, lessonId, "  # Heading\n*literal*  ", NOW)
  ).toEqual({ ok: true });
  expect(getNote(db, base.user.id, lessonId)).toEqual({
    body: "# Heading\n*literal*",
    updatedAt: "2026-11-17T12:00:00.000Z",
  });
  expect(
    saveNote(
      db,
      base.user.id,
      lessonId,
      "Replacement",
      new Date("2026-11-17T14:00:00.000Z")
    )
  ).toEqual({ ok: true });
  expect(getNote(db, base.user.id, lessonId)).toEqual({
    body: "Replacement",
    updatedAt: "2026-11-17T14:00:00.000Z",
  });
  expect(getSavedForUser(db, base.user.id).savedNotes).toHaveLength(1);
});

it("accepts exactly 2,000 characters after trimming", () => {
  expect(
    saveNote(db, base.user.id, lessonId, `  ${"a".repeat(2000)}  `, NOW)
  ).toEqual({ ok: true });
  expect(getNote(db, base.user.id, lessonId)?.body).toBe("a".repeat(2000));
});

it("keeps each Student's Bookmarks and Notes private and orders Saved by latest activity", () => {
  const otherStudent = db
    .insert(schema.users)
    .values({
      name: "Other Student",
      email: "other@example.com",
      role: schema.UserRole.Student,
    })
    .returning()
    .get();
  const otherCourse = db
    .insert(schema.courses)
    .values({
      title: "Second Course",
      slug: "second-course",
      description: "Another course",
      salesCopy: "Second Course",
      status: schema.CourseStatus.Published,
      instructorId: base.instructor.id,
      categoryId: base.category.id,
    })
    .returning()
    .get();
  const otherModule = db
    .insert(schema.modules)
    .values({ title: "Advanced", courseId: otherCourse.id, position: 1 })
    .returning()
    .get();
  const secondLesson = db
    .insert(schema.lessons)
    .values({ title: "Second Lesson", moduleId: otherModule.id, position: 1 })
    .returning()
    .get();

  toggleBookmark(db, base.user.id, lessonId);
  saveNote(db, base.user.id, lessonId, "First Note", NOW);
  vi.setSystemTime(new Date("2026-11-17T13:00:00.000Z"));
  toggleBookmark(db, base.user.id, secondLesson.id);
  saveNote(db, base.user.id, secondLesson.id, "Second Note", new Date());
  toggleBookmark(db, otherStudent.id, lessonId);
  saveNote(db, otherStudent.id, lessonId, "Someone else's Note", new Date());

  const saved = getSavedForUser(db, base.user.id);
  expect(
    saved.savedBookmarks.map(
      ({ lessonId, lessonTitle, courseTitle, courseSlug }) => ({
        lessonId,
        lessonTitle,
        courseTitle,
        courseSlug,
      })
    )
  ).toEqual([
    {
      lessonId: secondLesson.id,
      lessonTitle: "Second Lesson",
      courseTitle: "Second Course",
      courseSlug: "second-course",
    },
    {
      lessonId,
      lessonTitle: "Lesson 1",
      courseTitle: "Test Course",
      courseSlug: "test-course",
    },
  ]);
  expect(saved.savedNotes.map(({ body }) => body)).toEqual([
    "Second Note",
    "First Note",
  ]);
  expect(saved.savedNotes).toMatchObject([
    {
      lessonId: secondLesson.id,
      lessonTitle: "Second Lesson",
      courseTitle: "Second Course",
      courseSlug: "second-course",
    },
    {
      lessonId,
      lessonTitle: "Lesson 1",
      courseTitle: "Test Course",
      courseSlug: "test-course",
    },
  ]);
  saveNote(
    db,
    base.user.id,
    lessonId,
    "Edited first Note",
    new Date("2026-11-17T14:00:00.000Z")
  );
  expect(
    getSavedForUser(db, base.user.id).savedNotes.map(({ body }) => body)
  ).toEqual(["Edited first Note", "Second Note"]);
  expect(
    getSavedForUser(db, otherStudent.id).savedNotes.map(({ body }) => body)
  ).toEqual(["Someone else's Note"]);
  expect(getSavedForUser(db, otherStudent.id).savedBookmarks).toHaveLength(1);
  expect(getSavedForUser(db, base.instructor.id)).toEqual({
    savedBookmarks: [],
    savedNotes: [],
  });
});

it("the database enforces one Bookmark and one Note per Student per Lesson", () => {
  toggleBookmark(db, base.user.id, lessonId);
  saveNote(db, base.user.id, lessonId, "Original", NOW);
  expect(() =>
    db.insert(schema.bookmarks).values({ userId: base.user.id, lessonId }).run()
  ).toThrow(/UNIQUE/);
  expect(() =>
    db
      .insert(schema.notes)
      .values({ userId: base.user.id, lessonId, body: "Duplicate" })
      .run()
  ).toThrow(/UNIQUE/);
  expect(getSavedForUser(db, base.user.id).savedBookmarks).toHaveLength(1);
  expect(
    getSavedForUser(db, base.user.id).savedNotes.map(({ body }) => body)
  ).toEqual(["Original"]);
});

it("approving a Refund keeps the Student's Bookmarks and Notes", async () => {
  const admin = db
    .insert(schema.users)
    .values({
      name: "Platform Admin",
      email: "admin@example.com",
      role: schema.UserRole.Admin,
    })
    .returning()
    .get();
  const purchase = db
    .insert(schema.purchases)
    .values({
      userId: base.user.id,
      courseId: base.course.id,
      amountPaid: 7900,
      createdAt: "2026-11-16T12:00:00.000Z",
    })
    .returning()
    .get();
  db.insert(schema.enrollments)
    .values({ userId: base.user.id, courseId: base.course.id })
    .run();
  toggleBookmark(db, base.user.id, lessonId);
  saveNote(db, base.user.id, lessonId, "Keep my writing", NOW);
  const before = getSavedForUser(db, base.user.id);
  const notifications = fakeNotifications();
  const raised = await raiseRefundRequest(
    db,
    purchase.id,
    base.user.id,
    "Changed my mind",
    NOW,
    notifications
  );
  if (!raised.ok) throw new Error(raised.error);
  const approved = await approveRefundRequest(
    db,
    raised.refundRequestId,
    admin.id,
    null,
    NOW,
    notifications
  );
  expect(approved.ok).toBe(true);
  expect(getSavedForUser(db, base.user.id)).toEqual(before);
});
