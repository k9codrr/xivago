import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth-edge";
import type { Session } from "next-auth";

type AuthedRequest = NextRequest & { auth: Session | null };

// Every app page needs a signed-in user; only auth, legal pages and the
// machine-facing endpoints below are reachable while logged out. Signed-out
// visitors are sent to /login with a callbackUrl back to where they were going.
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/privacy", // legal pages must be readable before sign-up
  "/terms",
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/api/demands", // GET is public; POST is guarded inside the route itself
  "/api/referrals/check", // signup forms validate a referral code before the account exists
  "/_next",
  "/favicon.ico",
  "/manifest.json",
  // Push service worker: browsers refuse a worker script served behind a
  // redirect, so it must skip the login / trial / onboarding redirects below.
  "/sw.js",
];

const ADMIN_PREFIX = "/admin";

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * API routes must never redirect on auth failure — a `fetch()` caller
 * follows the redirect, lands on the /login HTML page, and then chokes on
 * `res.json()`. Page routes redirect for a normal browser navigation
 * experience; API routes get the same JSON `{error:{code,message}}` shape
 * every route handler uses (§6), just emitted from middleware instead of
 * inside the handler.
 */
function unauthenticated(isApi: boolean, req: AuthedRequest) {
  if (isApi) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "You must be signed in." } },
      { status: 401 },
    );
  }
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function forbidden(isApi: boolean, req: AuthedRequest, message: string) {
  if (isApi) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message } }, { status: 403 });
  }
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("error", "AccountBanned");
  return NextResponse.redirect(url);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const isApi = isApiRoute(pathname);

  if (pathname.startsWith(ADMIN_PREFIX) || pathname.startsWith("/api/admin")) {
    if (!user) return unauthenticated(isApi, req);
    if (!user.isAdmin) {
      if (isApi) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Admins only." } },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!user) return unauthenticated(isApi, req);
  if (user.isBanned) return forbidden(isApi, req, "This account has been suspended.");

  // New accounts finish onboarding before anything else. Pages only: API
  // calls (including the onboarding ones) are never redirected. The cookie
  // (holding the user id, so it never carries over to another account)
  // covers the gap between saving onboarding and the token refreshing.
  if (
    !isApi &&
    user.onboarded === false &&
    !pathname.startsWith("/onboarding") &&
    req.cookies.get("xv_onboarded")?.value !== user.id
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
  }

  // 7-day free trial access control
  const isPaymentAllowedPath =
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/invoices") || // past payments stay viewable after a trial ends
    pathname.startsWith("/credits/refunds") || // so does asking for a top-up back
    pathname.startsWith("/api/refund-requests") ||

    pathname.startsWith("/api/subscriptions") ||
    pathname.startsWith("/api/payments") ||
    pathname.startsWith("/api/users/me");

  if (!isPaymentAllowedPath && !(user as { isPro?: boolean }).isPro) {
    const createdAtStr = (user as { createdAt?: string | Date }).createdAt;
    if (createdAtStr) {
      const createdTime = new Date(createdAtStr).getTime();
      const trialEndsTime = createdTime + 7 * 24 * 60 * 60 * 1000;
      if (Date.now() > trialEndsTime) {
        if (isApi) {
          return NextResponse.json(
            {
              error: {
                code: "TRIAL_EXPIRED",
                message: "Your 7-day free trial has expired. Complete payment to restore full access.",
              },
            },
            { status: 403 }
          );
        }
        const redirectUrl = new URL("/checkout", req.nextUrl.origin);
        redirectUrl.searchParams.set("reason", "trial_expired");
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except static assets, so that the allow-list above
     * (rather than a broad matcher exclusion) is the single source of truth
     * for what's public.
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
