// PROTOTYPE — throwaway setup for the Knock spike (issue #25). Never merge.
// Creates + commits the two workflows and the environment default preference
// set in Knock's Development environment via the Management API.
// Run: npx tsx scripts/prototype-knock-setup.ts
process.loadEnvFile(".env");
const token = process.env.KNOCK_SERVICE_TOKEN;
if (!token) throw new Error("KNOCK_SERVICE_TOKEN missing from .env");
const ENV = "development";
export {};

async function mapi(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://control.knock.app/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log(method, path, res.status);
  if (!res.ok) throw new Error(text);
  return JSON.parse(text);
}

const inAppStep = (markdown_body: string, action_url: string) => ({
  type: "channel",
  ref: "in_app_feed_1",
  name: "In-app feed",
  channel_key: "in-app",
  template: { markdown_body, action_url },
});

// Categories live in a project-wide catalog and must exist before a workflow uses them.
for (const name of ["discussion-reply", "new-enrollment"]) {
  await mapi("PUT", `/preference_categories/${name}`);
}

await mapi("PUT", `/workflows/discussion-reply?environment=${ENV}&commit=true&allow_empty=true&commit_message=prototype`, {
  workflow: {
    name: "Discussion Reply",
    categories: ["discussion-reply"],
    steps: [
      inAppStep(
        "**{{ actor.name }}** replied to your question on *{{ data.lesson_title }}*",
        "{{ data.lesson_url }}"
      ),
    ],
  },
});

await mapi("PUT", `/workflows/new-enrollment?environment=${ENV}&commit=true&allow_empty=true&commit_message=prototype`, {
  workflow: {
    name: "New Enrollment",
    categories: ["new-enrollment"],
    steps: [
      inAppStep(
        "**{{ actor.name }}** enrolled in *{{ data.course_title }}*",
        "/instructor"
      ),
    ],
  },
});

// Off by default, opt-in: the environment-level baseline for every recipient
// who has never set their own preferences.
await mapi("PUT", `/environments/${ENV}/defaults`, {
  preference_set: {
    categories: { "new-enrollment": { channel_types: { in_app_feed: false } } },
  },
});

console.log(JSON.stringify(await mapi("GET", `/environments/${ENV}/defaults`), null, 2));
