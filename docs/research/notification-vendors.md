# Hosted notification vendors for Cadence

Research for [issue #5](https://github.com/AidanBuzzaroo/cohort-005-project/issues/5), part of the Notifications map ([issue #2](https://github.com/AidanBuzzaroo/cohort-005-project/issues/2)).

- **Question:** Which hosted vendors can give Cadence an in-app Notification feed and possibly take over email? Cadence runs React Router 8 (SSR), React 19, Tailwind 4 and a Node server, and sends email through Postmark today.
- **Sources:** All sources were read on **2026-11-16**. Pricing pages change often, so recheck them before you commit to a vendor.
- **Confidence markers:**
  - Unmarked claims come from an official page that was fetched directly.
  - *(search snippet)* means a search engine's summary of the vendor's own docs. That page was not opened.
  - *(not stated)* means the pages fetched did not say.

## TL;DR

**Shortlist: Knock and Novu Cloud.**

- **Knock** has the most complete feed product for what Cadence wants:
  - A lasting feed. In-app feed items are kept indefinitely.
  - A styled React feed plus headless hooks.
  - Native Postmark delivery.
  - Per-user preferences on every plan, including Free.
  - RS256-signed user tokens, with a Node helper to sign them.
  - The main gaps: no EU data residency yet (expected "by the end of 2026"), and a large price jump from Free to $250/mo Starter.
- **Novu Cloud** fits our Tailwind-and-headless stack best:
  - `appearance.elements` accepts Tailwind class strings.
  - The React hooks cover notifications, counts and preferences.
  - The EU region is live today, and Postmark is supported.
  - The first paid tier is cheap ($30/mo Pro).
  - The main gaps: Inbox messages are kept for only 30 days on Free and 90 days on paid plans, so the feed is not truly lasting. Free is also capped at 5 workflows.

**If EU residency becomes a hard requirement before Knock ships it, replace Knock with Courier.** Courier's docs say the EU datacenter (Ireland) is on every paid plan. Courier also has native Postmark, React 19 support and pay-per-send pricing.

**SuprSend, MagicBell and Engagespot are excluded:**
- SuprSend puts preferences behind its $250 Business plan.
- MagicBell has no native Postmark integration, and its free tier is 1,000 deliveries.
- Engagespot's site, docs and API all returned 404 when checked.

## Comparison

Billing units differ between vendors:
- Knock bills per message, meaning one delivery to one user on one channel.
- Novu bills per workflow run.
- Courier bills per send.
- MagicBell bills per delivery, counted per channel.
- SuprSend bills per notification, counted per channel.

| | Knock | Novu Cloud | Courier | MagicBell | SuprSend |
|---|---|---|---|---|---|
| React package (latest, React peer) | `@knocklabs/react` 0.15.1, React 17–19 | `@novu/react` 3.19.2, React 18–19 | `@trycourier/courier-react` 9.3.5, React >=18 | `@magicbell/react` 1.14.0, no peer declared | `@suprsend/react` 1.5.0, React >=16.8 |
| Headless option | Yes: `useNotifications`, `useNotificationStore` | Yes: `useNotifications`, `useCounts`, `usePreferences` | Yes: `useCourier()`, custom views *(partly search snippet)* | Not documented | Yes: `@suprsend/react-core` *(search snippet)* |
| Styling fit for Tailwind | CSS variables (`--rnf-*`), or replace the CSS (`rnf-` classes) | Tailwind classes directly in `appearance.elements` | `CourierInboxTheme` object | CSS variables (`--magicbell-*`) | Customizable *(not stated how)* |
| Real-time | Socket *(transport not named)* | WebSocket (`wss://…socket.novu.co`) | Real-time, synced across devices *(transport not named)* | "Persistent connection" *(not named)* | *(not stated)* |
| Node SDK | `@knocklabs/node` → `workflows.trigger` | `@novu/api` → `novu.trigger` | `@trycourier/courier` → `send.message` *(search snippet)* | Browser/Node client | *(not stated in pages fetched)* |
| Postmark | Native (server token, optional webhook, `MessageStream` override) | Native (server token + from address) | Native (server token, `providers.postmark.override`) | Not listed (SES, Mailgun, SendGrid, Ping, SMTP) | Native *(search snippet)* |
| Per-user preferences | All plans. Per-tenant preferences are Enterprise-only | `usePreferences` and a prebuilt preferences component | `<CourierPreferences />` plus hooks *(search snippet)* | `UserPreferences` component | **Business plan ($250) and up** |
| Client feed auth | Public key + user id. "Enhanced security mode" adds an RS256 JWT signed with `signUserToken` | `subscriberId` + `subscriberHash` = HMAC-SHA256(secret, id), hex | Backend-minted JWT with scopes, then `signIn({ userId, jwt })` | User JWT, HS256, signed with the project secret | Public key + `distinctId` + ES256 JWT `userToken` *(search snippet)* |
| Free tier | 10k messages/mo, no hard cap | 10k runs/mo, 5 workflows, 3 seats, branded Inbox | 10k sends/mo | 1k deliveries/mo, 1 project | 10k notifications/mo, branded feed |
| First paid tier | Starter $250/mo, 50k messages, then $0.005 each | Pro from $30/mo, 30k runs, then $1.20 per 1k | Business $0.005 per send from send #1 | Startup $249/mo, 50k deliveries | Essentials $100/mo, 50k notifications |
| Feed retention | In-app feed items indefinite. Message logs 30 days (90 on Enterprise) | Inbox 30 days Free, 90 days Pro/Team | *(not stated)* | *(not stated)* | *(not stated)* |
| EU data residency | **Not yet.** "Expected by end of 2026" | **Yes:** `eu.api.novu.co` / `eu.socket.novu.co` | **Yes,** on Business and Enterprise (Ireland, `api.eu.courier.com`) | *(not stated)* | Yes per marketing pages, possibly Enterprise-only *(search snippet)* |
| Dev/test | Separate environments. CLI pulls and pushes workflows as code. Postmark channel has a sandbox mode | Dev + Prod environments. Keyless Inbox mode. `npx novu dev` tunnel | Test/production environments *(search snippet)* | Projects | Sandbox workspace (doesn't verify tokens unless enhanced security is on) *(search snippet)* |

## Per-vendor notes

### Knock

- **Feed UI:**
  - `@knocklabs/react` provides `KnockProvider`, `KnockFeedProvider`, `NotificationIconButton`, `NotificationFeedPopover` and `NotificationFeed`.
  - `NotificationFeed` takes `renderItem` for custom cells.
  - Styles come from `@knocklabs/react/dist/index.css`. You can override them with `--rnf-` CSS variables, or replace the file entirely, since every class starts with `rnf-`. `colorMode` handles dark mode. ([feed docs](https://docs.knock.app/in-app-ui/react/feed))
- **Headless:**
  - `useKnockClient()` → `useNotifications(client, channelId)` → `useNotificationStore(feed)` returns `items` and `metadata.unread_count`.
  - Headless code must call `markAsSeen` / `markAllAsSeen` itself. ([headless docs](https://docs.knock.app/in-app-ui/react/headless/feed))
- **Real-time:**
  - The docs mention socket connections. `auto_manage_socket_connection` disconnects inactive tabs.
  - An experimental BroadcastChannel option syncs tabs.
  - The transport is not named. ([feed docs](https://docs.knock.app/in-app-ui/react/feed))
- **Auth:**
  - By default, anyone with the public key can read any user's feed.
  - Enhanced security mode requires a JWT signed with RS256 and the environment's private signing key, with `sub` set to the user id.
  - `@knocklabs/node` exports `signUserToken(userId, { expiresInSeconds })`, which signs locally with no network call. The default expiry is 3600 seconds. ([security docs](https://docs.knock.app/in-app-ui/security-and-authentication))
- **Triggering:**
  - `client.workflows.trigger(key, { recipients, data })`.
  - A recipient can be a user id or an inline user object. Inline users are identified before the run.
  - Each call accepts up to 1,000 recipients. ([trigger API](https://docs.knock.app/api-reference/workflows/trigger), [knock-node](https://github.com/knocklabs/knock-node))
- **Postmark:**
  - Each environment needs its own channel with a server token and a from address.
  - Optional extras: a delivery-status webhook, a sandbox mode, and a `MessageStream` payload override. Without the override, mail goes on the default `outbound` stream.
  - The [pricing page](https://knock.app/pricing) says you pay providers such as Postmark directly. ([Postmark docs](https://docs.knock.app/integrations/email/postmark))
- **Preferences:**
  - Preferences can be set per workflow, per category, per channel type (including `in_app_feed`) and per channel.
  - Knock offers a hosted preference page behind a signed URL, or you build your own UI on the API. ([preferences docs](https://docs.knock.app/preferences/overview))
  - Preferences are available on every plan. Only per-tenant preferences are Enterprise-only. ([plans](https://docs.knock.app/manage-your-account/knock-plans))
- **Pricing:**
  - Free: 10k messages a month with no hard cap. Knock contacts you if you go over.
  - Starter: $250/mo for 50k messages, then $0.005 each. Starter also removes Knock branding.
  - SAML SSO, i18n and per-tenant branding are Enterprise-only. ([pricing](https://knock.app/pricing))
- **Retention:** In-app feed notifications "are available indefinitely". Message logs are kept 30 days, or 90 on Enterprise. ([data retention](https://docs.knock.app/manage-your-account/data-retention), *(search snippet)*)
- **EU:**
  - "EU data residency is coming soon … by the end of 2026."
  - Today Knock relies on SCCs and the EU-US Data Privacy Framework. ([plans](https://docs.knock.app/manage-your-account/knock-plans))
- **Dev/test:**
  - The Knock CLI pulls workflows to disk and pushes them back, which fits CI. ([CLI](https://docs.knock.app/developer-tools/knock-cli))
  - Usage counts in every environment.
  - No local emulator is documented.

### Novu Cloud

- **Feed UI:**
  - `<Inbox />` from `@novu/react` needs `applicationIdentifier` and `subscriber`.
  - `routerPush` hooks into React Router's `navigate`.
  - A keyless mode lets you try it with no setup. Its data expires after 24 hours. ([get started](https://docs.novu.co/platform/inbox/react/get-started))
- **Styling:**
  - Tailwind class strings go straight into `appearance.elements`, and elements also accept callbacks that return class strings.
  - `appearance.variables` and the `--nv-*` CSS variables control theming. ([styling](https://docs.novu.co/platform/inbox/configuration/styling))
- **Headless:** `useNotifications` handles filters, pagination and bulk read/archive. `useCounts` updates in real time. `usePreferences` gives global and per-workflow preferences. ([headless mode](https://docs.novu.co/platform/inbox/headless-mode), *(search snippet)*)
- **Real-time:** WebSocket. `socketUrl` is `wss://eu.socket.novu.co` for EU accounts.
- **Auth:**
  - Your server computes `subscriberHash` = `HMAC-SHA256(secretKey, subscriberId)` and sends it as a lowercase hex string.
  - When HMAC is on, the Inbox won't load without the hash.
  - Passing a `context` also needs a `contextHash` computed over canonical JSON. ([prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production))
  - A subscriber passed to the Inbox is created automatically. Updating an existing subscriber's profile from the client requires the hash.
- **Triggering:** `new Novu({ secretKey, serverURL })` from `@novu/api`, then `novu.trigger({ workflowId, to: { subscriberId }, payload })`. ([TS SDK](https://docs.novu.co/platform/sdks/server/typescript))
- **Postmark:** Add a server token and a verified from address, then set the integration to Active. ([Postmark](https://docs.novu.co/platform/integrations/email/postmark))
- **Pricing:**
  - Free: 10k runs, 5 workflows, 2 environments, 3 members, branded Inbox.
  - Pro: from $30/mo for 30k runs, then $1.20 per 1k. Pro removes the branding.
  - Team: from $250/mo. ([pricing](https://novu.co/pricing), [branding](https://docs.novu.co/platform/inbox/prepare-for-production))
  - **Watch:** the 5-workflow cap on Free will bind quickly with four recipient roles and several event types.
- **Retention:**
  - Inbox feed: 30 days on Free, 90 days on Pro/Team, custom on Enterprise.
  - Activity log: 1 day on Free, 7 days on Pro. ([limits](https://docs.novu.co/platform/developer/limits))
  - This conflicts with "a lasting feed". Decide this under "Backfill and retention" on the map.
- **EU:**
  - The EU API and socket endpoints are documented.
  - The pricing page lists "US + EU" only under Free. That is probably a page-layout quirk, but **confirm EU availability on the paid tiers.**
- **Dev/test:**
  - Dev and Prod environments.
  - `npx novu dev` opens the dashboard's Local environment through a tunnel. That is for code-first "Framework" workflows. ([local studio](https://docs.novu.co/framework/studio), *(search snippet)*)
  - Novu is open source, but we would use only Cloud.

### Courier (runner-up, strongest EU fallback)

- **Feed UI:**
  - `@trycourier/courier-react` v9 (React 18+): call `courier.shared.signIn({ userId, jwt })`, then render `<CourierInbox />`.
  - Theming goes through `CourierInboxTheme`.
  - Read and archive state syncs across devices.
  - The older `@trycourier/react-inbox` is deprecated. ([Inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview))
- **Auth:** Your backend mints a JWT with your API key and the right scopes. Preferences need `read:preferences` and `write:preferences`. *(search snippet: [authenticate users](https://www.courier.com/docs/in-app/authenticate-users))*
- **Preferences:** `<CourierPreferences />`, or the headless `useCourier().preferences` hooks. Preferences are enforced at send time. *(search snippet: [embed preferences](https://courier.com/docs/platform/preferences/use-guides/embed-courier-preferences))*
- **Node:** `@trycourier/courier`, then `client.send.message({ message: { to: { user_id }, template, data } })`. *(search snippet: [Node SDK](https://www.courier.com/docs/sdk-libraries/node))*
- **Postmark:**
  - Native: add a server token and a from address.
  - Per send, you can override `MessageStream` and the sender, or use Postmark templates. ([Postmark](https://www.courier.com/docs/external-integrations/email/postmark))
- **Pricing:**
  - Developer (free): 10k sends a month.
  - Business: $0.005 per send, **including the first 10k**. For example, 50k sends cost $250.
  - There is no flat fee, so cost scales smoothly from zero. ([pricing](https://www.courier.com/pricing))
- **EU:**
  - The datacenter docs say it is "available on every paid plan: Business and Enterprise", hosted in Ireland at `api.eu.courier.com`, managed from `app.eu.courier.com`. ([EU datacenter](https://courier.com/docs/platform/workspaces/eu-datacenter))
  - Courier's 2026 blog says Enterprise only, so get written confirmation.
- **Retention and real-time transport:** *(not stated)*

### MagicBell (excluded)

- **Feed UI:** `@magicbell/react` provides `FloatingInbox`, `Inbox`, `UserPreferences` and `ToastContainer`. It is themed with `--magicbell-*` CSS variables. Headless hooks are not documented. ([React lib](https://www.magicbell.com/docs/libraries/magicbell-react))
- **Auth:** A user JWT, HS256, signed with the project secret. The claims are `user_external_id` and/or `user_email`, plus `api_key`. ([user JWT](https://www.magicbell.com/docs/api/authentication/user))
- **Email:** Supported providers are SES, Mailgun, SendGrid, Ping Email and SMTP. **No Postmark.** SMTP might work but is unverified. ([email channel](https://www.magicbell.com/docs/channels/email))
- **Pricing:** Free is 1k deliveries a month. Startup is $249/mo for 50k. ([pricing](https://www.magicbell.com/pricing))
- **EU:** *(not stated)*
- **Why excluded:** No native Postmark, a small free tier and no EU information.

### SuprSend (excluded)

- **Pricing and gating:**
  - Free: 10k notifications a month, branded feed.
  - Essentials: $100/mo for 50k, unbranded.
  - **User preferences, digests and i18n start at Business, $250/mo.** Custom or multi-region datacenters are Enterprise. ([pricing](https://www.suprsend.com/pricing))
- **Feed UI:** `@suprsend/react` is the current package; `@suprsend/react-inbox` is end-of-support. It offers drop-in or headless components. ([inbox React](https://docs.suprsend.com/docs/inbox-react))
- **Auth:** Auth has moved from HMAC to signed JWTs. *(search snippet:)* The token is ES256 with `entity_type: "subscriber"` and `entity_id` set to the user's distinct id, passed to `SuprSendProvider` as `userToken`.
- **Postmark:** Supported natively. *(search snippet: [Postmark](https://docs.suprsend.com/docs/postmark))*
- **EU:** Marketing pages claim US or EU residency, possibly Enterprise-only. *(search snippet)*
- **Why excluded:** Preferences cost $250/mo. Otherwise it is comparable to Knock.

### Engagespot (excluded)

- **What was observed on 2026-11-16:**
  - `engagespot.co`, `engagespot.co/pricing`, `docs.engagespot.co/docs/` and `api.engagespot.co` all returned **HTTP 404**.
  - The npm package `@engagespot/react-component` (latest 3.0.1) was last modified on 2025-05-09.
  - Older docs, seen only in search snippets, described a React component, an HMAC `userSignature` (deprecated in favour of a JWT `userToken`) and a Postmark provider.
- **What it means:** This research does not claim the company has shut down. It is excluded because nothing could be verified from a primary source.

## Other candidates not compared

- Self-hosted options (open-source Novu, Ntfy) are out of scope.
- No other hosted vendor with a React feed and Postmark support stood out.

## Implications for the map's open questions

- **Identity and user sync:**
  - Every finalist identifies users by our own id and signs it on the server.
  - The signing method differs: Knock uses an RS256 JWT, Novu an HMAC hex string, Courier a JWT with scopes.
  - In each case the signed value is produced in a React Router loader from the session user and passed to the client provider.
- **Where triggers go:** Each vendor has a single server call (`workflows.trigger`, `novu.trigger`, `send.message`) that fits the same route-action seam `sendEmail` uses today.
- **Email migration:** All three finalists can send through our existing Postmark server token. Moving email to the vendor would not mean changing email providers.
- **Dev/test (the `.outbox/` equivalent):**
  - No vendor offers a local emulator. Each offers a separate development environment.
  - A local fake behind our own trigger seam is still worth deciding.
- **Retention:** Knock keeps feed items indefinitely. Novu keeps 30 or 90 days by plan. This may decide between the two.

## Open uncertainties to resolve during a trial

1. Novu: is the EU region available on paid tiers?
2. Courier: does EU really apply to Business, or only to Enterprise?
3. Knock: is the EU launch date firm, and does the Free plan show Knock branding in the feed?
4. Knock and Courier: confirm the real-time transport, in case corporate proxies block WebSockets.
5. Whether each React package renders cleanly under React Router 8 SSR. It may need a client-only boundary.
