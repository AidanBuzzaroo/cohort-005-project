// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?"
// (https://github.com/AidanBuzzaroo/cohort-005-project/issues/25).
// Lives on the prototype/knock-spike branch only. Never merge.
import { Knock, signUserToken } from "@knocklabs/node";

// Probe for the ticket: does react-router dev put .env into process.env for
// server code? Record the answer before we load it ourselves (Node >= 21.7).
export const ENV_PRESENT_BEFORE_LOAD = !!process.env.KNOCK_SECRET_API_KEY;
if (!ENV_PRESENT_BEFORE_LOAD) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env — knockConfigured() reports it
  }
}

export const WORKFLOW_DISCUSSION_REPLY = "discussion-reply";
export const WORKFLOW_NEW_ENROLLMENT = "new-enrollment";
export const CATEGORY_NEW_ENROLLMENT = "new-enrollment";

export function knockConfigured() {
  return !!(
    process.env.KNOCK_SECRET_API_KEY &&
    process.env.KNOCK_SIGNING_KEY &&
    process.env.KNOCK_PUBLIC_API_KEY &&
    process.env.KNOCK_FEED_CHANNEL_ID
  );
}

let client: Knock | undefined;
export function knock() {
  client ??= new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });
  return client;
}

// Knock recipient ids are strings; Cadence user ids are integers.
export const knockId = (userId: number) => `cadence-user-${userId}`;

export function signFeedToken(userId: number) {
  return signUserToken(knockId(userId), {
    signingKey: process.env.KNOCK_SIGNING_KEY,
    expiresInSeconds: 60 * 60,
  });
}

export function feedClientConfig() {
  return {
    publicKey: process.env.KNOCK_PUBLIC_API_KEY!,
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID!,
  };
}

type Person = { id: number; name: string; email: string };
const inline = (p: Person) => ({ id: knockId(p.id), name: p.name, email: p.email });

// Check 2: called from the real createComment path for Discussion Replies.
// Recipients/actor are identified inline, so no separate user-sync step was needed.
export async function triggerDiscussionReply(args: {
  replier: Person;
  questionAuthor: Person;
  lessonTitle: string;
  lessonUrl: string;
  replyId: number;
}) {
  if (!knockConfigured()) return;
  if (args.replier.id === args.questionAuthor.id) return; // caused by someone else only
  await knock().workflows.trigger(WORKFLOW_DISCUSSION_REPLY, {
    actor: inline(args.replier),
    recipients: [inline(args.questionAuthor)],
    data: {
      lesson_title: args.lessonTitle,
      lesson_url: args.lessonUrl,
      replier_name: args.replier.name,
    },
    // idempotency probe for the triggering fog
    // (Knock dedupes on cancellation_key per recipient while a run is active)
    cancellation_key: `discussion-reply-${args.replyId}`,
  });
}

// Check 4: a new Enrollment → Instructor, off by default.
export async function triggerNewEnrollment(args: {
  student: Person;
  instructor: Person;
  courseTitle: string;
}) {
  return knock().workflows.trigger(WORKFLOW_NEW_ENROLLMENT, {
    actor: inline(args.student),
    recipients: [inline(args.instructor)],
    data: { course_title: args.courseTitle, student_name: args.student.name },
  });
}

export async function getPreferences(userId: number) {
  return knock().users.getPreferences(knockId(userId), "default");
}

export async function setNewEnrollmentInApp(userId: number, on: boolean) {
  return knock().users.setPreferences(knockId(userId), "default", {
    categories: {
      [CATEGORY_NEW_ENROLLMENT]: { channel_types: { in_app_feed: on } },
    },
  });
}

export async function resetPreferences(userId: number) {
  await knock().users.unsetPreferences(knockId(userId), "default");
}

// The message log (server-side, secret key) — proves "off" means "not sent",
// not just "not rendered".
export async function recentMessages(userId: number) {
  const page = await knock().users.listMessages(knockId(userId), { page_size: 10 });
  return page.items.map((m) => ({
    id: m.id,
    workflow: m.source?.key,
    status: m.status,
    channel: m.channel_id,
    inserted_at: m.inserted_at,
  }));
}

// Negative check for check 1: user A's token used against user B's feed.
export async function crossUserFeedRead(tokenOwner: number, feedOwner: number) {
  const token = await signFeedToken(tokenOwner);
  const { publicKey, feedChannelId } = feedClientConfig();
  const res = await fetch(
    `https://api.knock.app/v1/users/${knockId(feedOwner)}/feeds/${feedChannelId}`,
    { headers: { Authorization: `Bearer ${publicKey}`, "X-Knock-User-Token": token } }
  );
  return { status: res.status, body: (await res.text()).slice(0, 200) };
}
