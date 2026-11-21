# DigiLocker (Aadhaar) Identity Verification via Setu

One-time, lifetime identity verification for Xivago users. The user signs in to
**their own DigiLocker account**, agrees to share their Aadhaar, and we confirm
they are a real person. **We never store or show the Aadhaar number, photo,
address or XML.** The only thing the platform keeps is "verified on <date>", and
other users see a **Verified** badge on the profile.

> API details below were checked against Setu's DigiLocker docs
> (`docs.setu.co/data/digilocker`) in Nov 2026. Re-check field names in the
> sandbox before going live, because Setu can change them.

---

## 1. What you need from Setu (portal and business requirements)

### 1.1 Accounts and credentials

| Step | Where | What you get |
|---|---|---|
| 1. Sign up | Setu Bridge, the developer console (`bridge.setu.co`) | Org account |
| 2. Add the **DigiLocker** product in **Sandbox** | Bridge → Products → Data → DigiLocker | A sandbox product instance |
| 3. Copy credentials | Product instance → API keys | `x-client-id`, `x-client-secret`, `x-product-instance-id` |
| 4. Build and test against sandbox | `https://dg-sandbox.setu.co` | Working flow |
| 5. Request **Production** access | Bridge → "Go live", or contact Setu sales | Production credentials for `https://dg.setu.co` |

Setu's docs say "Contact Setu for providing the credentials", so expect a sales
or onboarding call even for sandbox.

### 1.2 What Setu usually asks for at go-live (KYB)

Setu is the authorised DigiLocker partner, so your business is checked before
production. Have these ready (confirm the exact list with your Setu contact):

- **A registered business**: Pvt Ltd, LLP or partnership. Individual developers
  are usually not onboarded for production.
- Company **PAN**, **GSTIN** and **CIN/LLPIN**, plus a director/authorised
  signatory's KYC.
- **Live website/app URL** with a **Privacy Policy** and **Terms of Service**
  that cover identity verification (see §8 for wording).
- **Use-case description**, for example: *"One-time identity verification of
  marketplace users. We only store a verified flag and date. We do not store
  the Aadhaar number or any document."*
- **Redirect URL(s)** you will use, for example
  `https://<your-domain>/api/verification/digilocker/callback`.
- A signed **commercial agreement**. Pricing is **per successful fetch** and is
  agreed with Setu; it is not listed publicly.

### 1.3 APIs you will use (only these 4)

All calls are server-to-server and need these headers:

```
x-client-id:            <SETU_DG_CLIENT_ID>
x-client-secret:        <SETU_DG_CLIENT_SECRET>
x-product-instance-id:  <SETU_DG_PRODUCT_INSTANCE_ID>
Content-Type:           application/json
```

| # | Call | Purpose |
|---|---|---|
| 1 | `POST /api/digilocker/` body `{ "redirectUrl": "..." }` | Creates a request. Returns `id`, `status:"unauthenticated"`, `url` (where the user logs in to DigiLocker) and `validUpto` |
| 2 | `GET /api/digilocker/:id/status` | Returns `status`: `unauthenticated`, `authenticated` or `revoked` |
| 3 | `GET /api/digilocker/:id/aadhaar` | Returns the `aadhaar` object: `name`, `dateOfBirth`, `gender`, `maskedNumber` (e.g. `xxxxxxxx1234`), `address`, `photo`, `xml`, and `verified.signature` |
| 4 | `GET /api/digilocker/:id/revoke` | Ends our access to the user's DigiLocker straight after we read the data → `{ "success": true }` |

We **do not** need `GET /api/digilocker/documents` or
`POST /api/digilocker/:id/document`, which are for PAN, driving licence and so on.

**Redirect back to us:** after consent, DigiLocker sends the user's browser to
`redirectUrl` with these query parameters:
`?success=True|False&id=<requestId>&scope=ADHAR[+PANCR...]&errCode=..&errMessage=..`.
You can add your own parameters to `redirectUrl`.

---

## 2. Flow

```
User (logged in)                 Xivago (Next.js)                         Setu / DigiLocker
────────────────                 ────────────────                         ─────────────────
[Verify with DigiLocker] ──POST /api/verification/digilocker/start──▶
                                 • reject if already verified
                                 • POST /api/digilocker/  ───────────────▶ creates request
                                 • save {setuRequestId, userId, PENDING} ◀── {id, url}
                    ◀── { url } ──
browser → url ─────────────────────────────────────────────────────────▶ DigiLocker login + OTP + consent
                    ◀──────────── 302 redirectUrl?success=True&id=... ───
GET /api/verification/digilocker/callback
                                 • session user must own the request row
                                 • GET /:id/status  == authenticated ────▶
                                 • GET /:id/aadhaar ─────────────────────▶ (Aadhaar JSON, in memory only)
                                 • checks: signature verified, DOB 18+
                                 • HMAC dedupe hash (no raw data)
                                 • tx: user.identityVerifiedAt = now, isVerified = true
                                 • GET /:id/revoke ──────────────────────▶
                                 • throw away the Aadhaar JSON
                    ◀── 302 /profile?verified=1
```

---

## 3. Data we keep, and data we never keep

| Data from DigiLocker | Keep? | Why |
|---|---|---|
| Full Aadhaar number | **Never received.** Setu only returns `maskedNumber` | Aadhaar Act s.29 |
| `maskedNumber`, `name`, `dateOfBirth` | **No.** Used in memory only to build a one-way HMAC | Stops one Aadhaar from verifying many accounts |
| `photo`, `address`, `xml.fileUrl`, `email`, `phone`, `gender` | **No.** Never read into the DB and never logged | Not needed |
| Verification date | **Yes**: `User.identityVerifiedAt` | Shows the badge |
| Provider | **Yes**: `"DIGILOCKER"` | Audit |
| Dedupe hash | **Yes**: `User.identityHash` (HMAC-SHA256, unique) | Stops duplicate accounts. Cannot be reversed without the server secret |
| Setu request id and status | **Yes**, for 30 days, then deleted | Debugging and disputes |

The public profile API returns only `identityVerified: boolean`. It never
returns the hash or the date.

---

## 4. Database changes (`packages/db/prisma/schema.prisma`)

Add these fields to `model User`, below `isVerified`:

```prisma
  // --- Identity (DigiLocker) -- see DIGILOCKER_VERIFICATION.md.
  // We store ONLY a timestamp + a keyed one-way hash. Never Aadhaar data.
  identityVerifiedAt  DateTime?
  identityProvider    String?            // "DIGILOCKER"
  identityHash        String?  @unique   // HMAC(name|dob|last4), dedupe only
  identityVerifications IdentityVerification[]
```

Add a new model and enum:

```prisma
enum IdentityVerificationStatus {
  PENDING
  VERIFIED
  FAILED
  EXPIRED
}

model IdentityVerification {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider      String   @default("DIGILOCKER")
  setuRequestId String   @unique
  status        IdentityVerificationStatus @default(PENDING)
  failureCode   String?  // e.g. CONSENT_DENIED, DUPLICATE_IDENTITY, UNDERAGE
  createdAt     DateTime @default(now())
  completedAt   DateTime?

  @@index([userId, createdAt])
}
```

Then run:

```bash
pnpm db:migrate   # or pnpm db:push in dev
pnpm db:generate
```

**How this fits with the existing `isVerified`:** today `isVerified` is set by
an admin (`/api/admin/users/[id]/verify`). It drives the `VERIFIED` trust pill
(`lib/trust.ts`) and controls who can feature posts (`lib/featured.ts`). When
DigiLocker verification succeeds we **also set `isVerified = true`**, so all of
that keeps working. `identityVerifiedAt` records that the verification came
from Aadhaar and not from an admin. The admin "Unverify" button should only
clear `isVerified`. That way a banned or abusive account cannot verify again
with the same Aadhaar, because `identityHash` stays.

---

## 5. Environment variables

Add these to `.env`, then to `serverEnvSchema` in `apps/web/src/lib/env.ts`:

```ts
  // DigiLocker via Setu. The feature is off when CLIENT_ID is empty.
  SETU_DG_BASE_URL: z.string().url().default("https://dg-sandbox.setu.co"),
  SETU_DG_CLIENT_ID: z.string().optional().default(""),
  SETU_DG_CLIENT_SECRET: z.string().optional().default(""),
  SETU_DG_PRODUCT_INSTANCE_ID: z.string().optional().default(""),
  // 32+ random bytes, e.g. `openssl rand -hex 32`. NEVER rotate after launch:
  // rotating breaks duplicate-Aadhaar detection for every existing user.
  IDENTITY_HASH_SECRET: z.string().optional().default(""),
```

For production, set `SETU_DG_BASE_URL=https://dg.setu.co` and use the production
credentials.

---

## 6. Code

### 6.1 Setu client: `apps/web/src/lib/setu-digilocker.ts`

```ts
import "server-only";
import { env } from "@/lib/env";

export function isDigilockerConfigured(): boolean {
  return Boolean(env.SETU_DG_CLIENT_ID && env.SETU_DG_CLIENT_SECRET && env.SETU_DG_PRODUCT_INSTANCE_ID);
}

async function setu<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.SETU_DG_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-client-id": env.SETU_DG_CLIENT_ID,
      "x-client-secret": env.SETU_DG_CLIENT_SECRET,
      "x-product-instance-id": env.SETU_DG_PRODUCT_INSTANCE_ID,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    // Log the status ONLY. Never log the body, which can contain Aadhaar data.
    throw new Error(`SETU_DG_${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createRequest(redirectUrl: string) {
  return setu<{ id: string; status: string; url: string; validUpto: string }>(
    "/api/digilocker/",
    { method: "POST", body: JSON.stringify({ redirectUrl }) },
  );
}

export function getStatus(id: string) {
  return setu<{ id: string; status: "unauthenticated" | "authenticated" | "revoked" }>(
    `/api/digilocker/${encodeURIComponent(id)}/status`,
  );
}

/** Only the fields we use are typed on purpose, so nobody is tempted to save the rest. */
export type AadhaarMinimal = {
  name: string;
  dateOfBirth: string; // "DD-MM-YYYY" in sandbox. Check the format in your responses.
  maskedNumber: string; // "xxxxxxxx1234"
  verified: { signature: boolean };
};

export async function getAadhaar(id: string): Promise<AadhaarMinimal> {
  const r = await setu<{ aadhaar: AadhaarMinimal }>(`/api/digilocker/${encodeURIComponent(id)}/aadhaar`);
  const { name, dateOfBirth, maskedNumber, verified } = r.aadhaar;
  return { name, dateOfBirth, maskedNumber, verified }; // drop photo/address/xml right away
}

export async function revoke(id: string): Promise<void> {
  try {
    await setu(`/api/digilocker/${encodeURIComponent(id)}/revoke`);
  } catch {
    /* best effort: the request also expires by itself */
  }
}
```

### 6.2 Hash and age helpers: `apps/web/src/lib/identity.ts`

```ts
import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

const norm = (s: string) => s.normalize("NFKD").replace(/[^a-z0-9]/gi, "").toUpperCase();

/** One-way and keyed. The same person always gets the same hash. It cannot be reversed without the secret. */
export function identityHash(a: { name: string; dateOfBirth: string; maskedNumber: string }): string {
  if (!env.IDENTITY_HASH_SECRET) throw new Error("IDENTITY_HASH_SECRET missing");
  const last4 = a.maskedNumber.slice(-4);
  return createHmac("sha256", env.IDENTITY_HASH_SECRET)
    .update(`${norm(a.name)}|${norm(a.dateOfBirth)}|${last4}`)
    .digest("hex");
}

/** Accepts "DD-MM-YYYY" or "YYYY-MM-DD". */
export function isAdult(dob: string, minAge = 18): boolean {
  const m = dob.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/) ?? null;
  const d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(dob);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - minAge);
  return d <= cutoff;
}
```

### 6.3 Start route: `apps/web/src/app/api/verification/digilocker/start/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/guards";
import { apiError, ApiErrors } from "@/lib/api-response";
import { env } from "@/lib/env";
import { createRequest, isDigilockerConfigured } from "@/lib/setu-digilocker";

export async function POST() {
  try {
    const user = await requireUser();
    if (!isDigilockerConfigured()) return apiError(503, "NOT_CONFIGURED", "Verification is not available right now.");

    const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { identityVerifiedAt: true } });
    if (me.identityVerifiedAt) return apiError(409, "ALREADY_VERIFIED", "Your identity is already verified.");

    // Basic rate limit: 5 attempts per 24h.
    const recent = await prisma.identityVerification.count({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 864e5) } },
    });
    if (recent >= 5) return apiError(429, "TOO_MANY_ATTEMPTS", "Too many attempts. Try again tomorrow.");

    const redirectUrl = `${env.NEXTAUTH_URL}/api/verification/digilocker/callback`;
    const req = await createRequest(redirectUrl);

    await prisma.identityVerification.create({ data: { userId: user.id, setuRequestId: req.id } });
    return NextResponse.json({ url: req.url });
  } catch (e) {
    if (e instanceof UnauthorizedError) return ApiErrors.unauthorized();
    console.error("[digilocker/start]", (e as Error).message);
    return apiError(502, "PROVIDER_ERROR", "Could not start verification. Please try again.");
  }
}
```

### 6.4 Callback route: `apps/web/src/app/api/verification/digilocker/callback/route.ts`

The user's browser lands here with a top-level GET from DigiLocker, so the
NextAuth session cookie (`SameSite=Lax`) is sent and `requireUser()` works.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@slotbook/db";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { env } from "@/lib/env";
import { getStatus, getAadhaar, revoke } from "@/lib/setu-digilocker";
import { identityHash, isAdult } from "@/lib/identity";

const back = (q: string) => NextResponse.redirect(`${env.NEXTAUTH_URL}/profile?${q}`);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const requestId = sp.get("id") ?? "";
  const ok = (sp.get("success") ?? "").toLowerCase() === "true";

  let user;
  try { user = await requireUser(); } catch { return NextResponse.redirect(`${env.NEXTAUTH_URL}/login`); }

  // The request must belong to THIS logged-in user, so nobody can replay another user's id.
  const row = await prisma.identityVerification.findUnique({ where: { setuRequestId: requestId } });
  if (!row || row.userId !== user.id || row.status !== "PENDING") return back("verify=invalid");

  const fail = async (code: string) => {
    await prisma.identityVerification.update({
      where: { id: row.id }, data: { status: "FAILED", failureCode: code, completedAt: new Date() },
    });
    await revoke(requestId);
    return back(`verify=failed&reason=${code}`);
  };

  if (!ok) return fail("CONSENT_DENIED");
  if (!(sp.get("scope") ?? "").includes("ADHAR")) return fail("AADHAAR_NOT_SHARED");

  try {
    const s = await getStatus(requestId);
    if (s.status !== "authenticated") return fail("NOT_AUTHENTICATED");

    const a = await getAadhaar(requestId);               // in memory only
    if (!a.verified?.signature) return fail("SIGNATURE_INVALID");
    if (!isAdult(a.dateOfBirth)) return fail("UNDERAGE");
    const hash = identityHash(a);
    // `a` goes out of scope here and is never saved or logged.

    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { identityVerifiedAt: new Date(), identityProvider: "DIGILOCKER", identityHash: hash, isVerified: true },
        }),
        prisma.identityVerification.update({
          where: { id: row.id }, data: { status: "VERIFIED", completedAt: new Date() },
        }),
      ]);
    } catch (e) {
      // Unique violation on identityHash: this Aadhaar already verified another account.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail("DUPLICATE_IDENTITY");
      throw e;
    }

    await revoke(requestId);
    return back("verified=1");
  } catch (e) {
    console.error("[digilocker/callback]", (e as Error).message); // message only, never the payload
    return fail("PROVIDER_ERROR");
  }
}
```

> If `Prisma` is not re-exported from `@slotbook/db`, import it the same way
> `lib/trust.ts` does (`from "@/lib/db"`).

### 6.5 Make sure the callback is reachable

Check `apps/web/src/middleware.ts` / `lib/auth.config.ts`. `/api/verification/*`
must not be blocked or redirected for logged-in users. The route checks auth
itself.

### 6.6 UI

**Button** (on `/profile/edit` or a settings page), shown only when the user is
not verified:

```tsx
"use client";
import { useState } from "react";

export function VerifyIdentityButton() {
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    const res = await fetch("/api/verification/digilocker/start", { method: "POST" });
    const body = await res.json();
    if (res.ok) window.location.href = body.url;   // full-page redirect to DigiLocker
    else { setBusy(false); alert(body.error?.message ?? "Something went wrong"); } // swap for the app's toast
  }
  return (
    <button onClick={start} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-white">
      {busy ? "Opening DigiLocker…" : "Verify with DigiLocker"}
    </button>
  );
}
```

Put a short consent line above the button (required under the DPDP Act):

> *"You'll sign in to DigiLocker and share your Aadhaar with Xivago once. We
> only check that you are a real adult. We do **not** store your Aadhaar
> number, photo or address. Only a 'Verified' badge is shown on your profile."*

**Badge:** in `app/profile/page.tsx`, `app/u/[id]/page.tsx` and
`components/suggested-users.tsx`, select `identityVerifiedAt` in the query and
pass only a boolean to the client:

```ts
const identityVerified = Boolean(user.identityVerifiedAt);
```

```tsx
{identityVerified && (
  <span title="Identity verified via DigiLocker" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
    <BadgeCheck className="h-4 w-4" /> Verified
  </span>
)}
```

On `/profile`, read `?verified=1` / `?verify=failed&reason=…` and show a toast:

| reason | Message |
|---|---|
| `CONSENT_DENIED` / `AADHAAR_NOT_SHARED` | "You need to share your Aadhaar in DigiLocker to verify." |
| `UNDERAGE` | "You must be 18+ to get verified." |
| `DUPLICATE_IDENTITY` | "This Aadhaar is already linked to another Xivago account." |
| `SIGNATURE_INVALID` / `PROVIDER_ERROR` / `NOT_AUTHENTICATED` | "Verification failed. Please try again." |

**APIs:** in `/api/users/me` and any public user endpoint, return
`identityVerified: Boolean(identityVerifiedAt)`. **Never** select
`identityHash` in any API response.

---

## 7. Maintenance

- **Lifetime:** `start` returns `409 ALREADY_VERIFIED` once `identityVerifiedAt`
  is set, so there is never a second paid Setu call for that user.
- **Cleanup cron:** add it next to the existing crons (`/api/cron/*`, protected
  by `CRON_SECRET`):
  - mark `PENDING` rows older than 1 hour as `EXPIRED`
  - delete `IdentityVerification` rows older than 30 days
- **Account deletion** (`dataDeletionAt` flow): clear `identityVerifiedAt`,
  `identityProvider` and `identityHash`. Cascade removes the attempt rows.
  If you want to keep blocking banned people from making new accounts with the
  same Aadhaar, keep only the hash for banned users and say so in the privacy
  policy.
- **Admin:** show "ID verified (DigiLocker) on <date>" in `/admin/users`.
  Never show any Aadhaar data, because we don't have it.
- **Logging:** never log Setu response bodies. Only log status codes and
  `error.message`. If you use Sentry or similar, scrub fields named `aadhaar`.
- **Secret:** keep `IDENTITY_HASH_SECRET` in your secret manager and back it
  up. Losing it means you can no longer detect duplicates. Leaking it alone
  does not reveal any Aadhaar.

---

## 8. Legal and compliance

- **Aadhaar Act s.29 / UIDAI rules:** we never receive or store the full
  Aadhaar number. We do not store the masked number either.
- **DPDP Act 2023:** get explicit consent (the line above the button). State the
  purpose (identity verification). Keep data to the minimum (a flag and a hash).
  Delete on request.
- **Privacy Policy clause** (add it):
  > "Identity verification: If you choose to verify, you share your Aadhaar
  > details from DigiLocker through our partner Setu (Brokentusk Technologies
  > Pvt Ltd). We use them once to confirm your identity and age, then discard
  > them. We keep only the date of verification and an irreversible
  > cryptographic token used to stop one identity from verifying multiple
  > accounts. Your Aadhaar number, photo and address are never stored or
  > displayed."
- Verification is **optional**. Don't make it compulsory to use the app, and
  avoid statements that suggest Aadhaar is mandatory.

---

## 9. Step-by-step checklist

1. [ ] Sign up on Setu Bridge and get the sandbox DigiLocker credentials (§1.1)
2. [ ] Add env vars and update `lib/env.ts` (§5). Generate `IDENTITY_HASH_SECRET`
3. [ ] Make the schema changes, then `pnpm db:migrate && pnpm db:generate` (§4)
4. [ ] Add `lib/setu-digilocker.ts` and `lib/identity.ts` (§6.1, §6.2)
5. [ ] Add the `start` and `callback` routes (§6.3, §6.4). Check middleware (§6.5)
6. [ ] Add the button, consent text, badge and toasts. Return only a boolean from the APIs (§6.6)
7. [ ] Test in sandbox: success, consent denied, duplicate (second account), replay of another user's `id`, already verified → 409
8. [ ] Search the code and logs for `aadhaar`, `photo` and `maskedNumber` to confirm nothing is saved
9. [ ] Add the cleanup cron and the account-deletion handling (§7)
10. [ ] Update the Privacy Policy and Terms (§8)
11. [ ] Complete Setu KYB (§1.2), get production credentials, set `SETU_DG_BASE_URL=https://dg.setu.co`
12. [ ] Register the production redirect URL with Setu. Make one real verification and check it end to end
13. [ ] Add a DECISIONS.md entry pointing to this file
