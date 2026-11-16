// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?"
// (issue #25). Lives on the prototype/knock-spike branch only. Never merge.
//
// This is neither prototype-skill branch (logic demo / UI variants): it is a
// vendor-fit spike. One page that renders the full state for all four checks.
// Switch users in the DevUI panel and everything below re-signs and refetches.
import { useEffect, useRef, useState } from "react";
import { Form, data } from "react-router";
import Knock, { type Feed, type FeedItem } from "@knocklabs/client";
import { ne } from "drizzle-orm";
import type { Route } from "./+types/prototype.knock";
import { getCurrentUserId } from "~/lib/session";
import { db } from "~/db";
import { users, UserRole } from "~/db/schema";
import {
  ENV_PRESENT_BEFORE_LOAD,
  crossUserFeedRead,
  feedClientConfig,
  getPreferences,
  knockConfigured,
  knockId,
  recentMessages,
  resetPreferences,
  setNewEnrollmentInApp,
  signFeedToken,
  triggerNewEnrollment,
} from "~/lib/knock-prototype.server";
import { eq } from "drizzle-orm";

async function requireUser(request: Request) {
  const id = await getCurrentUserId(request);
  if (!id) throw data("Select a user from the DevUI panel", { status: 401 });
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw data("Unknown user", { status: 401 });
  return user;
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!knockConfigured()) throw data("KNOCK_* env vars missing", { status: 500 });
  const me = await requireUser(request);
  const others = db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(ne(users.id, me.id))
    .all();
  return {
    me: { id: me.id, name: me.name, role: me.role, knockId: knockId(me.id) },
    others,
    userToken: await signFeedToken(me.id),
    ...feedClientConfig(),
    envPresentBeforeLoad: ENV_PRESENT_BEFORE_LOAD,
    preferences: await getPreferences(me.id).catch((e) => ({ error: String(e) })),
    messageLog: await recentMessages(me.id).catch((e) => [{ error: String(e) }]),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const me = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");
  switch (intent) {
    case "opt-in":
      await setNewEnrollmentInApp(me.id, true);
      return { did: "opted in to new-enrollment × in_app_feed" };
    case "opt-out":
      await setNewEnrollmentInApp(me.id, false);
      return { did: "opted out of new-enrollment × in_app_feed" };
    case "reset-prefs":
      await resetPreferences(me.id);
      return { did: "deleted my default preference set (back to env default)" };
    case "trigger-enrollment": {
      const student = db.select().from(users).where(eq(users.role, UserRole.Student)).get();
      if (!student) return { did: "no student in DB" };
      const res = await triggerNewEnrollment({
        student,
        instructor: me,
        courseTitle: "Prototype Course",
      });
      return { did: `triggered new-enrollment → me (actor ${student.name})`, res };
    }
    case "cross-user": {
      const other = Number(form.get("otherId"));
      return {
        did: `read user ${other}'s feed with MY token`,
        res: await crossUserFeedRead(me.id, other),
      };
    }
  }
  return { did: "unknown intent" };
}

type FeedSnapshot = {
  items: FeedItem[];
  metadata: { unread_count: number; unseen_count: number; total_count: number };
};

export default function KnockPrototype({ loaderData, actionData }: Route.ComponentProps) {
  const { me, others, userToken, publicKey, feedChannelId } = loaderData;
  const feedRef = useRef<Feed | null>(null);
  const [snap, setSnap] = useState<FeedSnapshot | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const note = (s: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l].slice(0, 20));

  async function refetch(why: string) {
    const feed = feedRef.current;
    if (!feed) return;
    try {
      await feed.fetch();
      const s = feed.getState();
      setSnap({ items: s.items, metadata: s.metadata });
      note(`refetch (${why}): ${s.items.length} items, unread ${s.metadata.unread_count}, unseen ${s.metadata.unseen_count}`);
    } catch (e) {
      setFeedError(String(e));
    }
  }

  // Headless feed, browser-side: public key + Cadence-signed user token.
  useEffect(() => {
    setSnap(null);
    setFeedError(null);
    const knock = new Knock(publicKey);
    knock.authenticate(me.knockId, userToken);
    const feed = knock.feeds.initialize(feedChannelId);
    feedRef.current = feed;
    note(`authenticated as ${me.knockId}`);
    refetch("init");
    return () => {
      feed.teardown();
      knock.teardown();
      feedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.knockId, userToken]);

  async function run(label: string, fn: (f: Feed) => Promise<unknown>) {
    if (!feedRef.current) return;
    await fn(feedRef.current);
    await refetch(label);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 text-sm">
      <div className="rounded border-2 border-dashed border-amber-500 bg-amber-50 p-3 dark:bg-amber-950/30">
        <strong>PROTOTYPE</strong>: Knock spike (issue #25). Throwaway, on <code>prototype/knock-spike</code> only.
        Not a Notification Feed design.
      </div>

      <section className="space-y-1">
        <h2 className="text-lg font-semibold">1 · Signed user token</h2>
        <p>
          Signed in as <strong>{me.name}</strong> ({me.role}) → Knock id <code>{me.knockId}</code>.
          Token: <code>{userToken.slice(0, 16)}…</code> (RS256, 1h). KNOCK_* already in process.env under react-router dev (before our loadEnvFile):{" "}
          <code>{String(loaderData.envPresentBeforeLoad)}</code>
        </p>
        <Form method="post" className="flex items-center gap-2">
          <input type="hidden" name="intent" value="cross-user" />
          <span>Negative test: read</span>
          <select name="otherId" className="rounded border px-2 py-1">
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.role})
              </option>
            ))}
          </select>
          <span>'s feed with my token</span>
          <button className="rounded border px-2 py-1">Try</button>
        </Form>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3 · Headless feed (browser, public key + user token)</h2>
        {feedError && <p className="text-red-600">Feed error: {feedError}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="rounded border px-2 py-1" onClick={() => refetch("manual")}>Refetch</button>
          <button className="rounded border px-2 py-1" onClick={() => run("mark all seen", (f) => f.markAllAsSeen())}>Mark all seen</button>
          <button className="rounded border px-2 py-1" onClick={() => run("mark all read", (f) => f.markAllAsRead())}>Mark all read</button>
        </div>
        <p>
          unread <strong>{snap?.metadata.unread_count ?? "…"}</strong> · unseen{" "}
          <strong>{snap?.metadata.unseen_count ?? "…"}</strong> · total{" "}
          <strong>{snap?.metadata.total_count ?? "…"}</strong>
        </p>
        <ul className="divide-y rounded border">
          {snap?.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-2">
              <div>
                <code className="text-xs">{item.source.key}</code>{" "}
                {/* `content` is the raw template; `rendered` is interpolated HTML containing
                    user-controlled names. Shown as plain text: sanitising is a Feed-UI concern. */}
                <span>{item.blocks[0] && "rendered" in item.blocks[0] ? htmlToText(item.blocks[0].rendered) : ""}</span>
                <div className="text-xs text-muted-foreground">
                  seen {item.seen_at ? "✓" : "✗"} · read {item.read_at ? "✓" : "✗"} · {item.inserted_at}
                </div>
              </div>
              <div className="flex gap-1">
                <button className="rounded border px-2 py-0.5" onClick={() => run("mark seen", (f) => f.markAsSeen(item))}>seen</button>
                <button className="rounded border px-2 py-0.5" onClick={() => run("mark read", (f) => f.markAsRead(item))}>read</button>
                <button className="rounded border px-2 py-0.5" onClick={() => run("mark unread", (f) => f.markAsUnread(item))}>unread</button>
              </div>
            </li>
          ))}
          {snap && snap.items.length === 0 && <li className="p-2 text-muted-foreground">Feed empty.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2 · Trigger</h2>
        <p>
          Reply to someone else's Discussion Question on a lesson page as this user, then switch to the
          question's author and come back here. The trigger lives in the real <code>createComment</code> action path.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4 · Preferences (new Enrollment → me, off by default)</h2>
        <div className="flex flex-wrap gap-2">
          {[
            ["reset-prefs", "Reset to env default"],
            ["opt-in", "Opt in"],
            ["opt-out", "Opt out"],
            ["trigger-enrollment", "Trigger new-enrollment → me"],
          ].map(([intent, label]) => (
            <Form method="post" key={intent}>
              <input type="hidden" name="intent" value={intent} />
              <button className="rounded border px-2 py-1">{label}</button>
            </Form>
          ))}
        </div>
        <Dump title="My default preference set (as Knock returns it)" value={loaderData.preferences} />
        <Dump title="Message log, server-side (last 10)" value={loaderData.messageLog} />
      </section>

      <Dump title="Last action" value={actionData ?? null} />
      <Dump title="Client log" value={log} />
    </div>
  );
}

function htmlToText(html: string) {
  if (typeof DOMParser === "undefined") return "";
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
}

function Dump({ title, value }: { title: string; value: unknown }) {
  return (
    <details open className="rounded border p-2">
      <summary className="font-medium">{title}</summary>
      <pre className="overflow-x-auto text-xs">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
