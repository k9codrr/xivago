# SlotBook

A seller-centric demand marketplace for Indian SMEs/MSMEs. Businesses post
short "demands"; vendors race FIFO to buy limited contact slots. Dual-channel
(app + WhatsApp), mobile-first PWA, Razorpay-powered from day one.

## Build status

This repo is being built milestone-by-milestone per the original spec's
build order (§9). Current status:

- [x] **M1** — Turborepo scaffold, full Prisma schema + seed, Auth.js v5
      (Credentials + Facebook), layout + bottom-nav shell
- [x] **M2** — Profiles (edit, public page, R2 avatar/logo upload)
- [x] **M3** — Demands (wizard, feed, expiry cron)
- [x] **M4** — Razorpay slots (orders, verify, refunds, webhook)
- [x] **M5** — Socket.IO chat
- [x] **M6** — WhatsApp package (OTP, notifications, webhook)
- [x] **M7** — PRO subscriptions, Threads-style forum (extended scope), Admin panel, PWA polish

See `DECISIONS.md` for every judgment call made where the spec was silent.

## Stack

Turborepo + pnpm · Next.js 15 (App Router) + React 19 + TypeScript strict ·
Tailwind v4 + shadcn-style primitives · Prisma 6 + PostgreSQL · Auth.js v5 ·
Razorpay · WhatsApp Cloud API · Socket.IO · Cloudflare R2.

## Prerequisites

- Node.js ≥ 20.11
- pnpm ≥ 9 (`corepack enable` will install the pinned version automatically)
- A PostgreSQL 15+ database (local via Docker, or a hosted instance e.g.
  Neon/Supabase/RDS)

## 1. Install

```bash
corepack enable
pnpm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in at minimum for local dev:

- `DATABASE_URL` — your Postgres connection string
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev

Everything else (Facebook, R2, WhatsApp, Razorpay) can stay blank until you
reach the milestone that uses it — `env.ts` treats those as optional in
development so `pnpm dev` still boots.

If you don't want to stand up Postgres yourself:

```bash
docker run --name slotbook-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=slotbook -p 5432:5432 -d postgres:16
```

## 3. Set up the database

```bash
pnpm db:generate   # generate the Prisma client
pnpm db:push       # push schema.prisma to your database (dev-friendly, no migration files)
pnpm db:seed       # admin user + service taxonomy + demo users + welcome credits
```

Once you're ready to track migrations properly (e.g. before your first
deploy), switch to:

```bash
pnpm --filter @slotbook/db exec prisma migrate dev --name init
```

Seeded accounts (all passwords are for local dev only — rotate before
shipping anywhere real):

| Email                    | Role     | Password       |
| ------------------------- | -------- | -------------- |
| admin@slotbook.in         | ADMIN    | `ChangeMe!123` |
| vendor1@slotbook.in       | VENDOR   | `Password!123` |
| vendor2@slotbook.in       | VENDOR   | `Password!123` |
| business1@slotbook.in     | BUSINESS | `Password!123` |

## 4. Run the app

```bash
pnpm dev
```

Opens `apps/web` at http://localhost:3000. Turborepo will run `dev` for
every package that defines it (currently just `@slotbook/web`; `apps/realtime`
joins in M5).

## 5. Other useful commands

```bash
pnpm typecheck     # tsc --noEmit across every workspace package
pnpm lint          # eslint across every workspace package
pnpm db:studio     # Prisma Studio GUI on your database
pnpm build         # production build of every workspace package
```

## Repo layout

```
apps/
  web/            Next.js 15 app (the whole product UI + API routes)
  realtime/       Socket.IO chat server — runs alongside web via `pnpm dev`
packages/
  db/             Prisma schema, generated client singleton, seed, credit ledger
  payments/       Razorpay client wrapper (orders, verify, refunds, subscriptions)
  whatsapp/       WhatsApp Cloud API client (OTP, notifications, webhook) — M6
```

`pnpm dev` (root) starts every workspace app's `dev` script in parallel via
Turborepo — `apps/web` on :3000 and `apps/realtime` on :3001 come up
together automatically. `apps/realtime` reads the same root `.env` file
directly (it's a plain Node process, not Next.js, so it can't auto-load
`.env` the way Next does) — make sure `SOCKET_JWT_SECRET` is set there
before starting chat.

**Note on the forum (§3.9):** the global chat forum is gated behind a PRO
subscription, which isn't wired up until M7. Building it now would mean
either an ungated forum (contradicts the spec) or a forum gate that can
never pass (nobody can be PRO yet) — so it's deferred to M7 rather than
half-built.

## Forum (M7 — extended scope)

The forum was extended beyond the original spec mid-build, by direct
instruction, into a Threads-style feature: comments, emoji reactions, image
attachments, and reporting. This required new database tables beyond the
original schema — see `DECISIONS.  md` #43 for exactly what was added and why
it's additive-only (nothing in the original schema was changed).

- **Posting a new thread requires PRO** (unchanged from the original spec).
  Commenting, reacting, and reporting are open to any logged-in user.
- **Image moderation is fail-closed by default.** Without
  `MODERATION_API_USER`/`MODERATION_API_KEY` set (Sightengine), every
  uploaded attachment sits in `PENDING` — visible only to its author —
  until an admin approves it at `/admin/forum`. Set those two env vars to
  enable automatic approve/reject instead.
- **Text is checked against a real profanity/hate-speech matcher**
  (`obscenity`) on every post and comment. This is a genuine, always-on
  baseline, not a stub — see `DECISIONS.md` #45 for its documented limits.
- Seed the admin account (`pnpm db:seed`, see below) and visit
  `/admin/forum` to review the moderation queue.

## Dark / light mode

Implemented app-wide via `next-themes` (`ThemeProvider` in the root layout,
`ThemeToggle` component) — class-based, not just OS `prefers-color-scheme`,
so users can override it. Fully realized throughout the new forum UI; the
shared primitives (`card-shell`, buttons, inputs, the bottom nav) carry dark
styling everywhere, though pages built in earlier milestones weren't all
individually re-audited for dark-mode polish — flagging that honestly
rather than claiming exhaustive coverage.

## WhatsApp setup (M6)

Before OTP login or any notification actually sends, you need:

1. A WhatsApp Business Platform (Cloud API) app in Meta Business Manager,
   with a phone number added.
2. All 5 templates approved (see the templates doc you provided) — their
   **names must exactly match** `packages/whatsapp/src/index.ts`'s
   `WHATSAPP_TEMPLATES` map: `slotbook_otp`, `slot_purchased`,
   `new_demand_match`, `demand_expiring`, `new_chat_message`.
3. `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET` filled in from
   that app.
4. `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — any random string you choose; set the
   *same* value when you register the webhook URL
   (`https://<domain>/api/webhooks/whatsapp`) in the App Dashboard.

Without these, `isWhatsAppConfigured()` returns false and every WhatsApp
code path degrades gracefully: OTP login shows a clear "not set up yet"
error (it's the one WhatsApp feature where failure is surfaced, since it's
the primary mechanism, not a supplementary notification — see
DECISIONS.md #37), and every notification sender in `lib/wa-notifications.ts`
just no-ops rather than throwing.

## Push notifications

Sent by `packages/push` (`sendPushToUsers`) for three events:

| Event | Sent from | Recipient | Opt-out key |
|---|---|---|---|
| New chat message | `apps/realtime` (skipped if the recipient has the chat open) | other participant | `chatMessages` |
| Slot purchased | `lib/push-notifications.ts` via `notifySlotPurchased` | demand author | `slots` |
| New follower | `api/users/[id]/follow` | followed user | `follows` |

Users turn push on per device from **Profile → Edit → Notifications**, which
subscribes the device and stores its token via `/api/users/me/push-token`
(`DeviceToken` table). The category toggles live in `MetaAccountLink.notifPrefs`.

Setup (both `apps/web` and `apps/realtime` read these from the root `.env`):

- **Web Push (browsers / installed PWA):** run `npx web-push generate-vapid-keys`,
  then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
  `VAPID_SUBJECT` (`mailto:you@example.com`). On iOS, web push only works once
  the app has been added to the Home Screen (iOS 16.4+).
- **Native (Capacitor iOS/Android):** set `FIREBASE_SERVICE_ACCOUNT`
  (service-account JSON, raw or base64), and install
  `@capacitor/push-notifications` in the native shell. Android needs a
  notification channel with id `xivago_default`.
- Run `pnpm --filter @slotbook/db push` (or a migration) to create the
  `device_tokens` table.

Without these env vars each channel silently no-ops.

## Social features (post-M7)

- **Follow / unfollow** users; profiles show follower and following counts
  (each opens a full list) and two tabs — *Threads* (their forum posts) and
  *Demands* (what they've posted). See `DECISIONS.md` #51-52.
- **Communities** — anyone logged in can create one, join/leave, and post
  inside it. Community posts are forum posts with a `communityId`, so
  comments, emoji reactions, image attachments, reporting, and moderation all
  work inside communities with no duplicated code. Posting requires
  *membership*, not PRO (the global forum still requires PRO). See
  `DECISIONS.md` #53-54.
- **Chat** supports image attachments, replies, and emoji reactions.
- **PRO** users get unlimited demand posting (FREE stays capped at 3/month).

After pulling these changes, re-run `pnpm db:generate && pnpm db:push` — the
schema gained `Follow`, `Community`, `CommunityMember`, and chat
attachment/reaction tables.

## Money-safety invariants (do not violate these)

1. `User.creditBalance` is **only** ever mutated through
   `applyCreditDelta()` in `packages/db/src/credits.ts`. It writes the
   ledger row and updates the balance in one transaction, every time.
2. Slot allocation (`/api/payments/verify`, M4) re-validates the demand is
   still `OPEN` and unexpired **inside** the same transaction that creates
   the `Bid` rows, so a demand that fills or expires mid-checkout can never
   allocate a slot that shouldn't exist — the payment gets refunded instead.
3. Every Razorpay and WhatsApp webhook handler is idempotent, keyed on the
   provider's own event/message id (`razorpayPaymentId`, `NotificationLog.waMessageId`).
4. A demand's `authorPhone` is only ever serialized by the API when
   `shareContact === true` **and** the requester is the author, a slot
   holder on that demand, or an admin — see the comment block in
   `GET /api/demands/[id]` (M3) for the exact branch.


 pnpm --filter @slotbook/db seed:demands to set seed data



 <!-- & 'c:\Users\lenovo\Downloads\xivago\xivago\apps\web\public\Xivago_Categories Latest.xlsx'   refer to this file for the full extended flow of   
  categories  if something similar keep one out of it but make sure you priortize this doc only and add additional things and in tags while      
  filtering or posting the tags should be in a dropdown with search options and can add max to 5  and also if user search on the platfor in any  
  categories subcategory provider's related tag then that should be shown the related providers how are providing those services else you are    
  smart enough add according to the flow of the whole project else keep everything same and intact , also for now comment out the sending and    
  receiving of credits on the platform dont remove just comment down , and also make sure the forum communities part the joined community's post 
  should be also visible at the forum page not only inside community only but there also with the community name and when click on that name of  
  community on the post it should be redirected to that community and make the side-menu using shadcn ui sidebar and keep design same but also   
  below communities inside the sidebar there must be shown 4-5 communities joined by the user and create all the community lisst named inside    
  the communitypart in the provided doc .xlsx file -->

{
  "crons": [
    {
      "path": "/api/cron/expire-demands",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/cron/whatsapp-notifications",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/cron/featured-cycle",
      "schedule": "5 * * * *"
    },
    {
      "path": "/api/cron/trust-monthly",
      "schedule": "35 18 * * *"
    }
  ]
}



  , media and all right , link , and all in tab like telegram does with the badge of his and all profile image kind     
  thing should be there so that every details are there , and when keyboard closes on phone the message input should    
  not get upward , like it gets desplaced from its position , right , else keep functionality intact , when hold then   
  only reaction and other option should show like forwarding and all and on the very page of chat the right corner edit 
  icon when user click on it should open the send direct message to other user on the platform and it someone is not    
  on the platform then he should be able to invite im adding their name or email if email it sould send mail using      
  resend , and sms should open that person's whatsapp and send the invite to him, single tick = sent , double tick mean 
  , as you know and , blue double tick means seen , and also user active or not green dot on the user's profile avatar  
  , on the feed page owhen user  click to open the drawer than , it should also work the same way as posting an offer   
  or request drawer  and scrolling and all like that for the feed drawer  and when user mentioned someone of feed posts 
  and after post posted the click on the mentioned name it takes to error page it should take user to the  user's       
  profile got it , and drawer is good of feed posting but not properly best doesnot open full view thats why prefer the 
  posting drawer and theme things also . else everything on it is good , and scroll to top button on feed page ,        
  folder creation inside bookmarks page like user does inside instagram if he wants to optional and design and layout   
  must be followed of instagram , also show near by users recommendantions profiles and posts , eve if not enable the   
  filtering of near by , add locations selection feature to the demand and request posting drawer , like on  insta ,    
  swiggy , amazon and all we add location things  when type location shoudl show all the related location and when      
  slect it gets set , and location and any kind of permissions should be get store it should not ask the user everytime 
  on the platform , either its location or any other got it , or camer media and all until he has set it to allow once  
  , and when click pos offer or post request button on posting drawer than it should show the  animtaion like fampay    
  does , paytm does , and others does and the after it complete the other screen of whatever comes after it should be   
  shown and animations must be best in class like not just ok for showing no it must be best use motions grapics and    
  all eveything for any kind of posting  on the platform , or procees or progress thing on the platform add animation   
  in between , but it should go with the platform , like scanning qr and if qr have been scanned by the scanner than    
  animation on the qr scanner if the qr has been scanned then also animation on the qr code , and if money is credited  
  and all then also and if credits are used using pin enter then after it also should be there , right and with sounds  
  go and if anything you need from the web or internet do it all yourself you have all the permissions , also fix the   
  booting price to 50 credits from 20
 
