# DECISIONS.md

Running log of judgment calls made where the spec was silent or ambiguous.
Newest at bottom.

## M1

1. **Realtime architecture (§4 "pick the simpler reliable option, document it")**
   Chose a **separate `apps/realtime`** Node/Socket.IO server rather than
   bolting a custom server onto Next.js. Reasoning: Next 15 App Router has no
   first-class custom-server hook without ejecting from `next start`, which
   breaks Vercel deploys. A standalone Socket.IO process (deployed separately,
   e.g. on Railway/Fly/a small VM, or Vercel via a serverless-incompatible
   host) keeps `apps/web` deployable to Vercel as-is and keeps the realtime
   process independently scalable. Built in M5; scaffold folder reserved now.

2. **Package manager / monorepo tool**: pnpm + Turborepo, as explicitly specified.

3. **Auth.js version**: v5 (`next-auth@beta`), JWT session strategy (no DB
   sessions) since we already have a Prisma `User` model shaped for our own
   needs and don't want NextAuth's adapter tables mixed into the schema in
   §5, which is specified exactly and has no `Account`/`Session` tables.
   Consequence: Facebook OAuth linking is done manually in the `signIn`/`jwt`
   callbacks against `User.email`/`MetaAccountLink.facebookId`, not via the
   Prisma adapter.

4. **Password hashing**: `bcryptjs` (pure JS, avoids native build issues in
   serverless/edge-adjacent environments) at cost factor 12.

5. **Role picker persistence**: `User.role` starts as `VENDOR` per schema
   default; onboarding screen lets the user flip to `BUSINESS` once, then
   it's editable from Settings same as any profile field. No separate
   "hasOnboarded" flag was in the schema, so we derive "needs onboarding"
   from `services.length === 0 && companyName === null` — good enough as a
   soft nudge, never a hard gate, so nobody gets stuck.

6. **Env validation**: added a single `src/lib/env.ts` using Zod to fail
   fast at boot if required vars are missing, rather than discovering it at
   request time in production.

7. **Timezone for "calendar month" quota (§3.3) and cron windows**: all
   server-side date logic uses UTC via native `Date`/`date-fns`, documented
   in `packages/db/src/quota.ts` (M3) — no per-user timezone in schema, so
   "calendar month" = UTC calendar month. Flagged as a v2 candidate if
   Indian users near month boundaries complain (IST is UTC+5:30, so this can
   shift the reset by up to ~5.5h from their local midnight).

8. **`services` seed taxonomy**: since §9 says "service categories ~10 tags
   each" without naming categories, chose 10 SME-relevant categories common
   in the Indian MSME market (Packaging, Printing, Logistics, Digital
   Marketing, Web/App Dev, Photography, Catering, Interior/Fit-out,
   Manufacturing/Job-work, Legal/Compliance) with ~10 free-text tags each.
   Editable in `packages/db/prisma/seed.ts`.

9. **shadcn/ui**: components are generated into `apps/web/src/components/ui`
   as needed per milestone rather than all up front, to avoid dumping unused
   boilerplate in M1.

10. **`user.phoneVerified` (§3.1) vs. the exact schema (§5)**: the prose spec
    says "Set user.phoneVerified=true on success" but the Prisma schema in
    §5, which the brief says to use *exactly*, has no such column on `User`
    (only `phone: String?`). Since §5 is explicitly authoritative and exact,
    I did not add a column. For now, `Session.user.phoneVerified` (session
    type only, M1) is derived as `Boolean(user.phone)` — a placeholder proxy,
    not a real verification flag. This will be revisited in M6 (WhatsApp
    OTP): either (a) treat "phone set at all" as good enough since the only
    way `phone` gets populated in this build is through a verified OTP flow
    in the first place, or (b) flag a schema-exact-vs-prose conflict back to
    the product owner and add a migration. Decision deferred to M6.

## M2

11. **Service taxonomy moved to `packages/db/src/service-categories.ts`**
    (was inline in `seed.ts`). The profile-edit tag picker needs the same
    list the seed uses, so it's now a shared export rather than duplicated
    data that could drift.

12. **R2 upload flow**: client asks the server for a presigned PUT URL
    (`POST /api/uploads/sign`), uploads directly to R2 from the browser, then
    submits the resulting public URL as a normal field on
    `PATCH /api/users/me`. The server never proxies image bytes. Presigned
    PUT URLs (unlike POST policies) can't enforce a max Content-Length at
    the R2 layer, so size/type are checked client-side (≤5MB, image/* only)
    before requesting a signature, and the object key is namespaced
    `avatars/{userId}/{uuid}.{ext}` / `logos/{userId}/{uuid}.{ext}` so a
    malicious client can at worst overwrite its own user's files, never
    another user's.

13. **Website field validation**: stored as entered but normalized to
    always include a scheme (`https://` prepended if missing) so the public
    profile page can safely render it as an `<a href>` without a
    javascript:-scheme XSS vector — enforced both in the Zod schema
    (rejects any scheme other than http/https) and again by construction.

14. **Public vs. own profile shape**: `GET /api/users/[id]` and the `/u/[id]`
    page never serialize `email`, `passwordHash`, `phone`, `creditBalance`,
    `isBanned`, or `isVerified`-adjacent internals. `phone` in particular
    stays server-side entirely until M3's per-demand contact-reveal logic
    decides to expose it — there is no public-profile code path that can
    leak it, by construction (the Prisma `select` simply never includes it).

15. **Middleware auth-failure responses split by route type**: the M1
    middleware always redirected to `/login` on auth failure, which is
    correct for page navigations but breaks `fetch()` callers hitting
    protected API routes (redirect → HTML page → `res.json()` throws).
    Fixed in M2: any `/api/*` path now gets a JSON
    `{error:{code,message}}` 401/403 from middleware itself instead of a
    redirect; page routes keep redirecting to `/login`. Applies retroactively
    to `/api/users/me` and every protected route added from here on.

## M3

16. **"Service tag" / "category" on demands — another schema-vs-prose
    conflict**: §6's API surface says demand feed filters include "service
    tag", and §3.6.B2's WhatsApp copy references a demand "category"
    (`{{1}}` in `new_demand_match`). The exact §5 schema has no
    category/tag column on `Demand` — only `summary`. Since §5 governs, I
    did not add a column. Feed filtering (`GET /api/demands?q=`) and, in
    M6, vendor-match notification targeting both work the same way instead:
    a case-insensitive substring match of the query/vendor-service term
    against `Demand.summary`. It's a real limitation (a demand summary that
    says "need boxes" won't match a vendor whose tag is literally
    "Packaging" unless the word appears in the text) — flagged here rather
    than silently pretending it's equivalent to a real taxonomy field. If
    this turns out to matter in practice, the fix is a migration adding
    `Demand.category String?` seeded from the same `SERVICE_CATEGORIES`
    list already shared with the profile picker.

17. **Posting beyond the free quota is blocked, not charged**: §3.3 defines
    3 free demands/month but never describes a paid path to post more (that
    exists for slots and PRO, not for demand posts themselves). `POST
    /api/demands` returns 403 `QUOTA_EXCEEDED` once the quota is used, with
    `resetsAt` in the response so the client can show "quota resets in N
    days" rather than a dead end.

18. **Boost-without-enough-credits fails the whole request, not just the
    boost**: if `isPriority: true` is submitted but the user has fewer than
    `CREDIT_BOOST_COST` credits, `POST /api/demands` returns 402
    `INSUFFICIENT_CREDITS` and creates nothing — it does not silently fall
    back to posting a non-priority demand. Money/credit rules should never
    produce a different outcome than what the user asked for without them
    explicitly choosing that (§10: "server-side" enforcement, but also just
    good practice for anything touching a balance).

19. **`demand_expiring` WhatsApp notification is queued, not sent, in M3**:
    the cron (`/api/cron/expire-demands`) identifies OPEN demands expiring
    within 24h that don't already have a `NotificationLog` row for
    `demand_expiring` + that demand id (stored in `payload.demandId`, since
    `NotificationLog` has no `demandId` column — matched via Prisma's JSON
    `path`/`equals` filter), and inserts one with `status: "QUEUED"`
    (overriding the schema's `"SENT"` default, which only makes sense once
    M6 actually calls the WhatsApp API). M6 will pick up `QUEUED` rows,
    call `@slotbook/whatsapp`, and flip them to `SENT`/`FAILED`.

20. **`FILLED` demands 410 for non-admins, per §3.8 literally** — even for
    the author and slot holders. This reads a little aggressively (their
    chat threads presumably still matter), but the spec is explicit
    ("EXPIRED/FILLED: ... → 410 Gone for everyone except ADMIN") and chat
    access in M5 goes through `/api/conversations`, not
    `/api/demands/[id]`, so a 410 on the demand detail doesn't actually
    block the conversation itself — just the demand-browsing view.

21. **Feed card slot data is embedded in `GET /api/demands`**, not fetched
    per-card from `/api/demands/[id]/slots`. A feed page with 20 cards
    doing 20 follow-up slot fetches would be a real N+1 problem; the list
    query includes up to 3 `Bid` rows (with bidder id/name/avatar) per
    demand directly. The dedicated `/api/demands/[id]/slots` endpoint from
    §6 still exists for the detail page and for any future client that
    only has a demand id.

22. **`NEXT_PUBLIC_SLOT_PRICE_PAISE` / `NEXT_PUBLIC_CREDIT_BOOST_COST`
    added**, mirroring the server-only `SLOT_PRICE_PAISE` /
    `CREDIT_BOOST_COST`. Neither is a secret — they're prices shown in the
    UI ("Grab Slot — ₹99", "−20 credits") — and duplicating them as public
    env vars avoids a round-trip to the server just to render copy. If they
    ever drift out of sync, the *server* value is always the one enforced.

23. **"Post-success screen" (§7 `/post`) implemented as a toast + redirect**
    to the new demand's detail page, rather than a dedicated intermediate
    screen — it shows the same information ("N of 3 free demands left")
    the spec asks for, just without an extra tap-through. Can be split into
    its own screen later if product wants a more celebratory moment there.

24. **`/post` is a single scrolling stepper, not five separate routes.**
    Step state lives in local component state (`useState<Step>`) rather
    than in the URL. Keeps back/forward navigation simple and avoids
    losing in-progress form state on a route change; the visible progress
    bar plus a working "back" button give the same wizard feel §7 asks for.

## Bug fix (post-M3): Prisma-in-Edge-middleware crash

25. **Root cause**: `middleware.ts` imported `auth` from the full
    `@/lib/auth`, which pulls in `@/lib/db` (Prisma) and the full
    Zod-validated server `env` (requires `DATABASE_URL` etc.) via its
    `jwt` callback's DB-freshness check. Next.js middleware runs on the
    **Edge runtime**, which cannot run Prisma's standard client at all (no
    TCP sockets, no Node core modules) and doesn't reliably expose every
    server env var the same way Node does. The result: every single
    middleware invocation — i.e. every page load, including the public
    homepage — either threw on `Invalid environment variables` or failed
    the Prisma call, which made the session look absent and bounced
    already-logged-in users straight back to `/login`.

    **Fix — the standard Auth.js v5 "split config" pattern**:
    - `lib/auth.config.ts` (new): Edge-safe base config. No `providers`, no
      DB access in any callback, `secret` read directly from
      `process.env.NEXTAUTH_SECRET` (not the Zod-wrapped `env`, so this
      file never requires `DATABASE_URL` to be set), `trustHost: true`
      (needed for self-hosted/local dev, avoids a separate `UntrustedHost`
      failure mode).
    - `lib/auth.ts` (rewritten): spreads `authConfig`, adds the real
      providers (Credentials, Facebook) and the DB-backed `signIn`/`jwt`
      callbacks. Used by `/api/auth/[...nextauth]` and `lib/guards.ts`
      (i.e. every Server Component/route handler) — Node runtime only.
    - `lib/auth-edge.ts` (new): `NextAuth(authConfig).auth` — nothing
      else. This is the only `auth()` middleware is allowed to import.
    - `middleware.ts`: now imports from `lib/auth-edge`, not `lib/auth`.

    **A second latent bug caught while fixing this**: Auth.js v5 defaults
    to reading `process.env.AUTH_SECRET` unless `secret` is passed
    explicitly. This repo uses the v4-style `NEXTAUTH_SECRET` name
    throughout (`.env.example`, README). Had `authConfig` not set `secret`
    explicitly, the Edge instance would have silently used a different
    (undefined) secret than the Node instance that signs tokens at login —
    reproducing the exact same "always redirected to login" symptom
    through a different mechanism. Both `auth.config.ts` and `auth.ts` now
    explicitly set `secret` to the same `NEXTAUTH_SECRET` value.

    **Trade-off accepted**: middleware's view of `role`/`isBanned` now
    reflects the JWT as of the last Node-side request (login, or any page/
    API call), not a fresh-every-request DB read. Every protected route
    handler still calls `requireUser()`/`requireAdmin()` — Node runtime,
    always DB-fresh — so this is defense-in-depth staleness, not a security
    gap: middleware being slightly stale can only be *more* restrictive
    than a moment-old ban, never grant access a route handler would refuse.

## M4

26. **"Buy 1 slot OR all 3 — never 2" (§3.4) is structurally impossible
    under the exact §5 schema, and I implemented the schema-compliant
    behavior instead.** `Bid` has `@@unique([demandId, bidderId])` — at
    most one `Bid` row can ever exist for a given (demand, bidder) pair.
    That makes it physically impossible for a single vendor to hold more
    than one slot on the same demand: a "buy all 3" purchase would require
    inserting 3 `Bid` rows with the same `bidderId` and the same
    `demandId`, which violates the unique constraint on the second insert.
    Since §5 is the authoritative, "use exactly this" schema, I did not
    work around it with a schema change. **Implemented behavior: every
    slot purchase is for exactly one slot, by one vendor, on one demand,
    for `SLOT_PRICE_PAISE` (₹99). A vendor who already holds a slot on a
    demand cannot buy another one on the same demand** — checked before
    creating the Razorpay order, re-checked inside the allocation
    transaction, and backstopped by the DB's own unique constraint if
    both application checks somehow race. `POST /api/payments/slot-order`
    therefore takes no `slotCount` parameter — §6 lists the route without
    a documented request body shape, so dropping the never-usable
    `slotCount: 1|3` distinction isn't a deviation from anything pinned
    down elsewhere, just from one prose sentence in §3.4 that doesn't
    survive contact with §5. If "one vendor buys out the whole demand"
    turns out to be a real product requirement, it needs a schema change
    (e.g. dropping the `bidderId` half of the unique constraint, or adding
    a separate `slotsPurchased` count) — flagging that explicitly rather
    than quietly deciding it doesn't matter.

27. **`Bid.pitch` (`@db.VarChar(280)`, NOT NULL) has no described input
    step, and — this matters more than it looks — there's no reliable way
    to collect one given decision #29's shared capture path.** §3.4's
    purchase flow never mentions a pitch-text step. Worse: even if the
    client submitted pitch text alongside `POST /api/payments/verify`,
    decision #29 means the *webhook* can beat that call and perform the
    allocation first — and Razorpay's webhook payload carries no field for
    our custom pitch text, so a client-submitted pitch is fundamentally
    unreliable to deliver to the row that actually gets created. Rather
    than ship a feature that silently drops text on the (real, expected)
    webhook-wins race, `Bid.pitch` is always created as `""` for now. The
    schema-compatible way to add a real pitch message later is to submit it
    as a Razorpay order `note` at `POST /api/payments/slot-order` time
    (before any race is possible) and have `captureSlotPayment` fetch the
    order's notes from Razorpay's API during allocation — noted here as the
    documented path rather than half-building it.

28. **A demand auto-transitions `OPEN → FILLED` the instant its 3rd slot
    sells**, inside the same allocation transaction that creates the 3rd
    `Bid`. This isn't explicitly stated in §3.4, but it's the only sensible
    reading once slots are actually purchasable: `PATCH
    /api/demands/[id]/close` (§6) exists for an author closing a demand
    *before* all slots sell, not as the only way a demand ever reaches
    `FILLED`. Both paths converge on the same `FILLED` status.

29. **Idempotent capture logic is shared, not duplicated, between
    `/api/payments/verify` and the `payment.captured` webhook handler** —
    exactly per §3.4's note that "webhook may beat the verify call." Both
    call the same `captureSlotPayment(orderId, razorpayPaymentId)` in
    `lib/slot-allocation.ts`; whichever runs first performs the real
    allocation-or-refund transaction, and the second call detects the
    `Payment` is already `CAPTURED` (via a `Bid` row referencing its id)
    and returns the existing result without re-charging, re-allocating, or
    double-refunding.

30. **Refund-on-failure is automatic and unconditional** (§3.4 step 5): if
    the allocation transaction can't find a free slot (demand expired or
    filled in the gap between order creation and payment capture),
    `captureSlotPayment` immediately calls `createRefund` in the same
    function before returning an error to the client. There is no
    "manually process refund" code path for this specific failure mode —
    money is never left taken without either a slot or a refund in flight.

31. **`Bid.paymentId` and `Payment.demandId` are plain columns, not Prisma
    relations — caught before shipping, but worth flagging loudly.** Neither
    has an `@relation` attribute in the exact §5 schema, and neither model
    has a corresponding back-reference field. That means Prisma's query
    engine has no knowledge these tables are related: `prisma.bid.findMany({
    select: { payment: {...} } })` or the equivalent on `Payment.demand`
    will fail at the type level (no such field exists) — there's no
    `include`/`select` shortcut across either edge. Everywhere the code
    needs both sides (`/api/my/slots`, `captureSlotPayment`), it fetches
    each table separately by the plain id column and joins in application
    code. Anyone extending this later (M7's admin payments table is the
    next obvious place this will come up) needs to do the same — reaching
    for `include: { payment: true }` on a `Bid` query will simply not
    compile.

## M5

32. **Realtime auth bridges NextAuth (cookie-based) and Socket.IO
    (separate process) via a short-lived, purpose-built JWT** — not by
    teaching `apps/realtime` to decode NextAuth session cookies directly.
    `GET /api/realtime/token` (Node runtime, behind `requireUser()`) mints a
    60-second JWT signed with `SOCKET_JWT_SECRET`; the browser passes it as
    the Socket.IO handshake `auth.token`; `apps/realtime` verifies it with
    the same shared secret and never talks to NextAuth or reads the session
    cookie at all. Keeps the two apps' auth concerns fully decoupled, which
    matters more once `apps/realtime` is deployed separately from `apps/web`
    per decision #1.

33. **"Only the 2 participants read/write; admin read-only" (§3.5) is
    enforced identically in three places** that all had to agree: the
    Socket.IO `join`/`message` handlers (`apps/realtime`), the REST message
    history route, and the REST read-receipt route. All three compute
    membership the same way (`buyerId === userId || bidderId === userId`)
    and all three block message *sending* for a non-participant admin while
    still allowing them to `join`/read. There's no shared package between
    `apps/web` and `apps/realtime` for this ~10-line check — duplicated
    deliberately rather than introducing a new shared package for something
    this small; if the rule ever changes, it needs to change in three
    places and that's a known, documented cost.

34. **`POST /api/conversations` never fabricates a conversation** for
    someone who hasn't bought a slot — it only upserts one for a caller who
    already holds a `Bid` on the named demand (i.e. one that
    `captureSlotPayment` should already have created). This keeps "a
    conversation implies a paid slot" true everywhere, not just on the
    happy path.

35. **The demand-author's "Chat" entry point lives on the `SlotStrip`, not
    as a single button**, since an author can have up to 3 separate
    conversations on one demand (one per slot holder) and a single generic
    "Chat" button would be ambiguous about which one to open. Filled slots
    become clickable (resolving `?bidderId=` via
    `GET /api/demands/[id]/conversation`) only when the viewer is the
    author; for a bidder, the single "Chat" button on the detail page
    resolves their own conversation with no disambiguation needed.

36. **Forum (§3.9) is NOT built in M5**, even though it's a "chat" feature
    in spirit. The original build order (§9) puts it in M7, gated by PRO
    subscriptions — since subscriptions don't exist until M7, building the
    forum now would mean either shipping it ungated (contradicts the spec's
    explicit PRO gate) or wiring a gate that can never pass. The bottom-nav
    Forum tab shows a "coming in M7" toast instead of a dead link.

## M6

37. **`User.email` is required + unique in the exact §5 schema, but
    WhatsApp OTP login/signup is phone-only and the spec never describes an
    email-collection step for it.** New phone-first users get a synthetic,
    clearly-marked placeholder email (`wa+<digits>@users.slotbook.in`),
    generated in `lib/otp.ts#findOrCreateUserByPhone`, editable later from
    Settings like any other profile field. Same shape of problem as
    decision #10 (`phoneVerified`) and #26 (slot count) — a real UX flow
    the exact schema doesn't leave room for, resolved with the least-bad
    schema-compliant option rather than a silent schema change.

38. **OTP state (code hash, expiry, attempt count) is stored in
    `NotificationLog.payload`, not a dedicated table** — because there is
    no OTP-specific table in the exact §5 schema, and adding one would be
    exactly the kind of silent schema deviation the brief prohibits.
    `NotificationLog` already exists for tracking WhatsApp sends and has a
    free-form `Json?` payload column, so it's repurposed: each OTP send
    creates one row (`templateName: "slotbook_otp"`), and verification
    reads/mutates that row's `payload.{codeHash,expiresAt,attempts,consumed}`.
    Rate limiting (3/hour, §3.1) is a `count()` over these rows in the last
    hour; the 5-attempt cap is scoped to the single most recent row (i.e.
    per code, not a global window) since exceeding it should push the user
    toward requesting a fresh code, which naturally resets the counter.

39. **Session issuance for OTP login uses the SAME client-side `signIn()`
    call (from `next-auth/react`) that email/password login already uses**
    — not the custom `POST /api/auth/whatsapp-otp/verify` REST route for
    the actual browser flow, even though that route exists and works
    (verified via NextAuth's own server-side `signIn()`, which is
    documented to work from Route Handlers). Reasoning: this repo already
    has one proven, working code path for Credentials-provider session
    issuance (the existing `/login` page's email/password flow). Routing
    the browser's OTP login through that exact same proven mechanism — just
    with `signIn("whatsapp-otp", {phone, code})` instead of
    `signIn("credentials", {...})` — carries far less risk than
    introducing a second, less-exercised path (server-side `signIn()`
    inside a Route Handler) onto the critical login flow. The REST
    `/verify` endpoint still exists because §6 lists it explicitly and it's
    useful for non-browser callers (a future native app, a script), and it
    shares the exact same `authorize()` logic — there's no duplicated
    verification code, just two callers of the one real implementation.

40. **`new_demand_match` digest is capped at one demand per vendor per
    run**, matching the template's shape (singular category/summary/
    budget/slots-left/link — not a list). "Max 1/day/vendor" (§3.6.B2) is
    enforced by a `NotificationLog` dedup check keyed on
    (templateName, toPhone, today), which means the combined WhatsApp cron
    (decision #41) can safely run every 15 minutes without over-sending —
    the daily cap is enforced by the dedup check, not by the cron's own
    schedule.

41. **`demand_expiring` (queued since M3), `new_demand_match`, and
    `new_chat_message` are all sent from ONE combined cron**
    (`/api/cron/whatsapp-notifications`, Bearer `CRON_SECRET`, every 15
    min) rather than three separate Vercel Cron jobs. Vercel's free/hobby
    tier caps the number of cron jobs per project; consolidating avoids
    burning that budget on low-frequency notification sends that don't
    individually need their own schedule. Each of the three sub-tasks is
    independently idempotent (its own `NotificationLog` dedup check), so
    sharing a schedule doesn't couple their correctness.

42. **`MetaAccountLink.notifPrefs` defaults to "everything on"** when a key
    is absent (`{}` is the schema default) — i.e. this is an opt-OUT model,
    not opt-in. Not specified either way in the spec; chosen because it
    matches how the four notification types are framed throughout §3.6 (as
    things that happen automatically "after an in-app action succeeds"),
    and an opt-in default would mean most users silently receive zero
    WhatsApp notifications despite the whole feature being built around
    them getting notified.

## M7

43. **The forum schema was extended, live in this conversation, by direct
    instruction** — a genuinely different situation from every other
    decision in this document. Everywhere else, "the schema is exact" meant
    working around gaps with the closest compliant interpretation. Here,
    the person directing the build explicitly asked for a Threads-style
    forum (comments, emoji reactions, attachments) that the original flat
    `ForumMessage` model cannot represent at all — no amount of creative
    interpretation gets from "a single VarChar(1000) message feed" to
    threaded comments and reactions. Treated as an authorized, additive
    schema extension: four new models (`ForumComment`, `ForumReaction`,
    `ForumAttachment`, `ForumReport`) and new back-relation array fields on
    `User` and `ForumMessage`. **Nothing in the original §5 text was
    removed, renamed, or retyped** — every original field, index, and
    relation is untouched; the diff is purely additive.

44. **Forum PRO-gating is preserved, per a same-conversation clarification**
    — the initial instruction ("anybody can create forum") read as removing
    §3.9's PRO gate; a follow-up clarified it meant "anybody *with PRO* can
    post," matching the original spec. With threads and comments now
    distinct concepts (added this session, decision #43), the gate maps
    naturally onto **creating a new thread** (`POST /api/forum`) — that's
    the direct analog of the original single-tier "POST" action the spec
    gated. **Commenting on an existing thread, reacting, and reporting are
    all open to any logged-in user, not just PRO** — the spec never
    described comments/reactions at all (they're new this session), so
    there's no original rule to preserve for them, and gating every reply
    behind PRO would make the forum unusable for FREE users even as
    read-only participants, which contradicts §3.9's "All logged-in users
    READ." `isPro()` is checked in exactly one place: thread creation.

45. **Attachment moderation is fail-closed by default, and the "detection"
    is honest about what it actually is.** There is no nudity/hate-content
    ML classifier wired up — no such credentials exist anywhere in the
    original spec's env vars, and shipping code that pretends to call a
    vision-safety API without real credentials would be worse than not
    having one. What's actually built:
    - **Text** (posts and comments): a real, always-available keyword/
      pattern matcher (the `obscenity` package — a maintained, widely-used
      library; not a hand-authored slur list) runs synchronously on submit.
      A match blocks creation outright with a clear error, not a silent
      flag. This is a real, functional baseline — and also a known-limited
      one (word-list matching misses context, coded language, and images
      entirely) — documented honestly rather than oversold.
    - **Images**: `lib/moderation.ts` defines a real integration against
      Sightengine's actual nudity-detection REST API (a genuine, commonly
      used third-party moderation service) — fully implemented, will work
      the moment `MODERATION_API_URL`/`MODERATION_API_KEY` are set. With no
      keys configured (the default in this delivery, since none were
      provided), every uploaded attachment is created with
      `status: PENDING` and **does not appear in the public feed** until an
      admin approves it from the new admin forum-moderation queue
      (`/admin/forum`) — a fully working manual review path, not a stub.
      Fail-closed (hidden until approved) rather than fail-open (visible
      immediately), because "keeping privacy intact, no nudity content"
      was explicit in the request — defaulting to visible-until-flagged
      would contradict that.
    - **Reporting**: any user can report a post or comment
      (`POST /api/forum/[id]/report`); reports land in the same admin queue
      and an admin can resolve (optionally soft-deleting the content) or
      dismiss.

46. **Reactions are single-choice per user per post/comment** (`@@unique
    ([targetType, targetId, userId])` — picking a new emoji replaces the
    old one, it doesn't add a second reaction row), matching Slack/Threads-
    style reaction UX rather than allowing a user to stack multiple
    different reactions on the same post. A small curated emoji set
    (👍 ❤️ 😂 😮 😢 👏) is enforced in application code, not the schema — the
    `emoji` column accepts any string at the DB level, but the API rejects
    anything outside the curated set so the reaction bar UI stays
    predictable and doesn't need to render arbitrary Unicode.

47. **PRO subscription activation is asynchronous, confirmed by webhook —
    not by the client's checkout success callback.** Unlike slot purchases
    (where `/api/payments/verify` synchronously allocates in the same
    request, because the user is waiting on a specific outcome — a slot),
    `/checkout`'s subscribe button shows an optimistic "activating" toast
    and lets the `subscription.activated` webhook do the actual
    `plan: PRO` write. This matches how Razorpay Subscriptions are meant to
    be integrated (recurring billing state changes are inherently
    asynchronous/webhook-driven, not request/response), and avoids
    building a redundant signature-verification endpoint for subscriptions
    that §6 never asked for in the first place.

48. **PRO now bypasses the 3-demand/month cap entirely** — not in the
    original spec, but reported as a bug ("even after pro plan im not able
    to create after 3 demands") and it's the only sensible fix: PRO
    otherwise gave demand-posters nothing (its only benefit was forum
    posting, a separate feature most vendors don't touch). `isPro()` is
    checked once in `POST /api/demands`; the quota response carries an
    `unlimited` flag rather than a numeric `remaining` that could go
    negative once a PRO user posts past 3.

## Chat enhancements (attachments, reactions, replies)

49. **Same additive-schema approach as the forum extension (#43)**: `Message`
    gets an optional self-relation (`replyToId`/`replyTo`/`replies`) plus
    two new tables, `MessageAttachment` and `MessageReaction` — nothing in
    the original `Message`/`Conversation` fields changed.

50. **Chat attachment moderation is fail-OPEN, unlike forum attachments
    (fail-closed, #45) — deliberately the opposite default, for a
    real reason.** The forum is a public, one-to-many broadcast surface;
    a DM conversation is already between two people who found each other
    through a paid, verified interaction (a slot purchase). If a
    moderation provider is configured, a detected-nudity image is still
    blocked outright. If none is configured, the image sends immediately
    with no pending/admin-review gate — queuing a stranger's private DM
    image for an admin to look at would itself be a worse privacy outcome
    than the thing moderation is meant to prevent.

## Follow system + profile tabs

51. **New additive `Follow` model** (self-relation on `User` via two named
    edges, `Following`/`Followers`) — not in the original spec, built by
    direct request. `user.following` = people this user follows (rows
    where they're `followerId`); `user.followers` = people following this
    user (rows where they're `followingId`). `@@unique([followerId,
    followingId])` makes following someone twice a no-op, not a duplicate
    row.

52. **"Chat feature like Threads" on a profile is a "Message" button that
    opens the most recent EXISTING conversation with that user, not a new
    generic DM system.** `Conversation` requires a `demandId` in the exact
    schema — there's no schema-compliant way to create a conversation with
    someone you haven't connected with through a demand/slot. Rather than
    changing `Conversation.demandId` to optional (a real, disruptive schema
    change affecting M4/M5's whole allocation flow) to support open-ended
    DMs, the profile's message button surfaces the real constraint
    honestly: if a conversation already exists, it opens it; if not, it
    explains chat opens once you're connected through a demand.

## Communities

53. **Community posts are `ForumMessage` rows with `communityId` set, not a
    parallel post system.** Rather than building a second full stack of
    post/comment/reaction/attachment/report models for communities, `Community`
    and `CommunityMember` are the only new tables — every other community
    feature (posting, commenting, reacting, attaching images, reporting,
    moderation) is the existing forum machinery, filtered by `communityId`.
    One consequence worth flagging: the same text/image moderation pipeline
    (#45) applies inside communities too, including the fail-closed
    attachment default.

54. **Community creation and posting are open to any logged-in user — not
    PRO-gated**, unlike the global forum. Not explicitly specified either
    way; chosen because (a) it wasn't requested, and (b) the PRO gate on
    the global forum exists specifically to protect one shared feed from
    spam (per §3.9's own framing) — a reason that doesn't obviously extend
    to a creator-moderated space. **Posting inside a community requires
    membership** (join first) instead of a subscription. This is a default,
    not a certainty — flip `requireUser + isPro` back on in
    `POST /api/forum` for the `communityId` branch if community creation
    should also be a PRO perk.

## Category workbook import

55. **`public/Xivago_Categories Latest.xlsx` is the source of truth for
    categories.** `apps/web/scripts/category-import/generate.py` turns it into
    `categories.data.json` (the tree, bundled for the client) and
    `category-tags.data.json` (~30k tags, 800 KB, server-only behind
    `/api/tags`). Previous-taxonomy subs that resemble a workbook sub are merged
    into it; the rest stay as additions (see `MERGE`, `MOVE`, `KEEP_MAINS`).

56. **The workbook states problems per sub category, not per provider**, so
    every workbook provider in a sub category lists that sub's problems.

57. **Retired category ids keep working through aliases** (`resolveCategoryId`),
    so old links and records resolve. `migrate:category-ids` rewrites stored ids
    once, because database filters can't follow aliases.

58. **Forum feed = global posts + posts from communities the viewer joined.**
    This replaces the "global feed excludes community posts" rule from #53;
    communities the viewer hasn't joined stay out of it.

59. **Credit sending/receiving is paused, not removed.** The code is commented
    out in place; pages redirect to /activity and the APIs return 410. Top-ups,
    spending, referral/spin rewards and history of past transfers are unaffected.

60. **A demand's poster is anonymous until the viewer buys a slot.** Name, image,
    company, bio and profile id are stripped on the server (`maskDemandAuthor`),
    not just hidden in the UI, on the feed, niche pages, sponsored and hero
    placements, bookmarks and the detail page. The poster and admins always see
    them. Location, trust tier and slot holders stay visible.

61. **Forum posts can carry up to 4 photos/videos.** This replaces the earlier
    one-attachment-per-post limit, which only the API and composer enforced, so
    no migration was needed. Each item is moderated on its own: one auto-rejected
    item rejects the post, and one pending item hides only itself. Posts open at
    `/forum/[id]` and media at `/forum/[id]/media/[index]`, as real routes so the
    device back button and shared links work.

## Promote / Requirement posts and post statistics

62. **Every post is a Promote or a Requirement, chosen first.** Requirement picks
    one role, then both types follow the same category flow, so requirements appear
    under category filters too. `postType` defaults to PROMOTE, so posts made before
    this show as promotions until they expire.

63. **Requirement roles are data, managed at `/admin/roles`.** `seed:roles` adds the
    starting list. A role that posts use can't be deleted, only hidden, so a post
    never loses its role. A rename also shows on existing posts.

64. **A post has one price.** The API takes `budget` and stores it in both
    `budgetMin` and `budgetMax`, so slot pricing, feed filters and older posts with a
    real range keep working. `formatBudgetRange` shows equal values as one amount.

65. **Post statistics are public and counted per viewer per UTC day.** Views count
    one per viewer per day; card clicks count every tap. The poster's own opens are
    not counted. Signed-out viewers are identified by a random id on their device,
    so the numbers are a good guide, not fraud-proof.

66. **Every credit payment needs a T-PIN and writes an invoice.** Slots, boosts, post
    fees and featured-bid holds all check the T-PIN on the server, right before the
    debit, along with the amount the user was shown. Lowering a bid refunds credits, so
    it needs neither. Five wrong tries lock the T-PIN for 15 minutes. A reset takes a
    code sent to the WhatsApp number proven at OTP login, or the account password, never
    `User.phone`, which anyone can edit on their profile. Invoices are snapshots in
    credits, not GST tax invoices.

67. **A phone number only changes through OTP, plus the T-PIN if one is set.** The
    number drives WhatsApp login and T-PIN resets, so the OTP proves ownership of the
    number and the T-PIN proves ownership of the account. Login now matches the proven
    number first. It falls back to the unverified `phone` only for accounts with no
    proven number, so older accounts aren't split in two at their next login.

68. **Only admins create communities and set their cover images.** This replaces the
    "open to any logged-in user" part of #54. It's enforced on the server: creation and
    cover edits live under `/api/admin/communities`, and `/api/uploads/sign` refuses the
    `community` kind for non-admins. Communities users already created stay as they are,
    and posting still only needs membership.

69. **The forum has two tabs.** Threads keeps the feed from #58. Communities shows only
    posts from joined communities, with a list view of every community. New and Hot are
    two orderings of one feed, so the filter menu treats them as a single choice, and
    Near me combines with either.

70. **Without a slot or PRO, a direct message is a request.** Messaging someone you have
    no chat with opens a direct conversation with status `PENDING` instead of being
    refused. The sender (`buyerId`) can keep writing; the recipient (`bidderId`) sees it
    under Requests and can only accept or decline. Until they answer, reading it sends no
    read receipt and they can't type, react or reply. Accepting makes it a normal chat;
    declining closes it to both sides and hides it from the recipient. PRO senders still
    open a normal chat straight away. The rule is checked on the realtime server and in
    post sharing, the two places that write messages. Demand pages still require a slot,
    since the poster's identity is part of what a slot buys.

71. **Joined communities lead the Communities list.** The first page holds every joined
    community, most recently joined first, then the rest by newest. Later pages exclude
    joined ones so none shows twice.
