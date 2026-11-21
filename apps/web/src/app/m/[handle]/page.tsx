import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

/**
 * /m/[handle] -- "@handle" mentions in posts link here. Communities are
 * checked first (new usernames can't shadow a community slug -- see
 * isUsernameAvailable), then people by username.
 *
 * A page with `redirect()` rather than a route handler: `redirect()` emits a
 * relative Location, so it works behind the tunnel / inside the app shell
 * (a route handler building the URL from `req.url` sent people to the
 * internal host and an error page), and Next's <Link> soft-navigates it.
 */
export default async function MentionRedirect({ params }: { params: Promise<{ handle: string }> }) {
  const handle = decodeURIComponent((await params).handle).replace(/^@/, "").toLowerCase();

  const community = await prisma.community.findFirst({
    where: { slug: { equals: handle, mode: "insensitive" } },
    select: { id: true },
  });
  if (community) redirect(`/communities/${community.id}`);

  const user =
    (await prisma.user.findUnique({ where: { username: handle }, select: { id: true } })) ??
    (await prisma.user.findFirst({ where: { username: { equals: handle, mode: "insensitive" } }, select: { id: true } }));
  redirect(user ? `/u/${user.id}` : `/search?q=${encodeURIComponent(handle)}`);
}
