// // import { notFound } from "next/navigation";
// // import Link from "next/link";
// // import type { Metadata } from "next";
// // import { Globe, MapPin } from "lucide-react";
// // import { getPublicProfileWithSocial } from "@/lib/profile";
// // import { getOptionalUser } from "@/lib/guards";
// // import { FollowButton } from "@/components/follow-button";
// // import { MessageButton } from "@/components/message-button";
// // import { ProfileTabs } from "@/components/profile-tabs";

// // interface PageProps {
// //   params: Promise<{ id: string }>;
// // }

// // export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
// //   const { id } = await params;
// //   const profile = await getPublicProfileWithSocial(id, null);
// //   if (!profile) return { title: "Profile not found" };
// //   return {
// //     title: profile.companyName ? `${profile.name} · ${profile.companyName}` : profile.name,
// //     description: profile.bio ?? undefined,
// //   };
// // }

// // const ROLE_LABEL: Record<string, string> = {
// //   VENDOR: "Vendor",
// //   BUSINESS: "Business",
// //   ADMIN: "SlotBook Team",
// // };

// // export default async function PublicProfilePage({ params }: PageProps) {
// //   const { id } = await params;
// //   const viewer = await getOptionalUser();
// //   const profile = await getPublicProfileWithSocial(id, viewer?.id ?? null);
// //   if (!profile) notFound();

// //   return (
// //     <main className="px-4 pt-6">
// //       <div className="card-shell mb-4 p-5 text-center">
// //         {/* eslint-disable-next-line @next/next/no-img-element */}
// //         <img
// //           src={profile.avatarUrl ?? "/icons/avatar-placeholder.svg"}
// //           alt={profile.name}
// //           className="mx-auto mb-3 h-20 w-20 rounded-full bg-neutral-100 object-cover"
// //         />
// //         <p className="text-lg font-semibold dark:text-neutral-100">{profile.name}</p>
// //         <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
// //           {ROLE_LABEL[profile.role] ?? profile.role}
// //         </span>

// //         {profile.companyName && (
// //           <div className="mt-3 flex items-center justify-center gap-2">
// //             {profile.companyLogo && (
// //               // eslint-disable-next-line @next/next/no-img-element
// //               <img src={profile.companyLogo} alt={profile.companyName} className="h-6 w-6 rounded object-cover" />
// //             )}
// //             <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{profile.companyName}</p>
// //           </div>
// //         )}

// //         {profile.bio && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{profile.bio}</p>}

// //         <div className="mt-4 flex flex-col items-center gap-1.5 text-sm text-neutral-500">
// //           {profile.location && (
// //             <span className="flex items-center gap-1.5">
// //               <MapPin className="h-4 w-4" /> {profile.location}
// //             </span>
// //           )}
// //           {profile.website && (
// //             <a
// //               href={profile.website}
// //               target="_blank"
// //               rel="noreferrer noopener"
// //               className="flex items-center gap-1.5 text-brand-600"
// //             >
// //               <Globe className="h-4 w-4" /> {profile.website.replace(/^https?:\/\//, "")}
// //             </a>
// //           )}
// //         </div>

// //         <div className="mt-4 flex justify-center gap-6">
// //           <Link href={`/u/${profile.id}/following`} className="text-center">
// //             <p className="text-base font-bold dark:text-neutral-100">{profile.followingCount}</p>
// //             <p className="text-xs text-neutral-400">Following</p>
// //           </Link>
// //           <Link href={`/u/${profile.id}/followers`} className="text-center">
// //             <p className="text-base font-bold dark:text-neutral-100">{profile.followerCount}</p>
// //             <p className="text-xs text-neutral-400">Followers</p>
// //           </Link>
// //         </div>

// //         {!profile.isViewerSelf && (
// //           <div className="mt-4 flex justify-center gap-2">
// //             <FollowButton userId={profile.id} initialFollowing={profile.isFollowedByViewer} />
// //             <MessageButton userId={profile.id} />
// //           </div>
// //         )}

// //         {profile.services.length > 0 && (
// //           <div className="mt-4 flex flex-wrap justify-center gap-1.5">
// //             {profile.services.map((s) => (
// //               <span
// //                 key={s}
// //                 className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
// //               >
// //                 {s}
// //               </span>
// //             ))}
// //           </div>
// //         )}
// //       </div>

// //       <ProfileTabs userId={profile.id} />

// //       <p className="py-4 text-center text-xs text-neutral-400">
// //         On SlotBook since{" "}
// //         {new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
// //       </p>
// //     </main>
// //   );
// // }

// import { notFound } from "next/navigation";
// import Link from "next/link";
// import type { Metadata } from "next";
// import { Briefcase, Calendar, Globe, MapPin } from "lucide-react";
// import { getPublicProfileWithSocial } from "@/lib/profile";
// import { getOptionalUser } from "@/lib/guards";
// import { FollowButton } from "@/components/follow-button";
// import { MessageButton } from "@/components/message-button";
// import { ProfileTabs } from "@/components/profile-tabs";

// interface PageProps {
//   params: Promise<{ id: string }>;
// }

// export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
//   const { id } = await params;
//   const profile = await getPublicProfileWithSocial(id, null);
//   if (!profile) return { title: "Profile not found" };
//   return {
//     title: profile.companyName ? `${profile.name} · ${profile.companyName}` : profile.name,
//     description: profile.bio ?? undefined,
//   };
// }

// const ROLE_LABEL: Record<string, string> = {
//   VENDOR: "Vendor",
//   BUSINESS: "Business",
//   ADMIN: "SlotBook Team",
// };

// export default async function PublicProfilePage({ params }: PageProps) {
//   const { id } = await params;
//   const viewer = await getOptionalUser();
//   const profile = await getPublicProfileWithSocial(id, viewer?.id ?? null);
//   if (!profile) notFound();

//   return (
//     <main className="pb-10">
//       {/* Banner — blurred avatar gives a "cover photo" feel until you add a real coverUrl field */}
//       <div className="relative h-32 w-full overflow-hidden ">
//         {profile.avatarUrl && (
//           // eslint-disable-next-line @next/next/no-img-element
//           <img
//             src={profile.avatarUrl}
//             alt=""
//             aria-hidden
//             className="h-full w-full object-cover opacity-80"
//           />
//         )}
//       </div>

//       <div className="px-4">
//         {/* Avatar overlapping banner + action buttons */}
//         <div className="flex items-end justify-between">
//           {/* eslint-disable-next-line @next/next/no-img-element */}
//           <img
//             src={profile.avatarUrl ?? "/icons/avatar-placeholder.svg"}
//             alt={profile.name}
//             className="-mt-10 z-50 h-20 w-20 rounded-full bg-neutral-100 object-cover ring-4 ring-white dark:bg-neutral-800 dark:ring-black"
//           />
//         </div>

//         {/* Name + role badge */}
//         <div className="mt-2.5">
//           <div className="flex items-center gap-1.5">
//             <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
//               {profile.name}
//             </h1>
//             <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
//               {ROLE_LABEL[profile.role] ?? profile.role}
//             </span>
//           </div>
//           {profile.companyName && (
//             <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
//               {profile.companyLogo && (
//                 // eslint-disable-next-line @next/next/no-img-element
//                 <img src={profile.companyLogo} alt="" className="h-4 w-4 rounded object-cover" />
//               )}
//               {profile.companyName}
//             </p>
//           )}
//         </div>

//         {/* Bio */}
//         {profile.bio && (
//           <p className="mt-2.5 whitespace-pre-wrap text-[15px] leading-6 text-neutral-900 dark:text-neutral-100">
//             {profile.bio}
//           </p>
//         )}

//         {/* Meta row — industry / location / website / joined */}
//         <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
//           {profile.companyName && (
//             <span className="flex items-center gap-1.5">
//               <Briefcase className="h-4 w-4" /> {profile.companyName}
//             </span>
//           )}
//           {profile.location && (
//             <span className="flex items-center gap-1.5">
//               <MapPin className="h-4 w-4" /> {profile.location}
//             </span>
//           )}
//           {profile.website && (
//             <a
//               href={profile.website}
//               target="_blank"
//               rel="noreferrer noopener"
//               className="flex items-center gap-1.5 text-brand-600 hover:underline"
//             >
//               <Globe className="h-4 w-4" /> {profile.website.replace(/^https?:\/\//, "")}
//             </a>
//           )}
//           <span className="flex items-center gap-1.5">
//             <Calendar className="h-4 w-4" />
//             <span>
//               Joined{" "}
//               {new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
//             </span>
//           </span>
//         </div>

//         {/* Following / Followers — inline X-style */}
//         <div className="mt-3 flex gap-5 text-sm">
//           <Link href={`/u/${profile.id}/following`} className="hover:underline">
//             <span className="font-bold text-neutral-900 dark:text-neutral-50">{profile.followingCount}</span>{" "}
//             <span className="text-neutral-500 dark:text-neutral-400">Following</span>
//           </Link>
//           <Link href={`/u/${profile.id}/followers`} className="hover:underline">
//             <span className="font-bold text-neutral-900 dark:text-neutral-50">{profile.followerCount}</span>{" "}
//             <span className="text-neutral-500 dark:text-neutral-400">Followers</span>
//           </Link>
//         </div>

//         {/* Services */}
//         {profile.services.length > 0 && (
//           <div className="mt-3 flex flex-wrap gap-1.5">
//             {profile.services.map((s) => (
//               <span
//                 key={s}
//                 className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
//               >
//                 {s}
//               </span>
//             ))}
//           </div>
//         )}
//       </div>
//       <div className="w-full flex justify-center items-center mt-2 px-5">
//         {!profile.isViewerSelf && (
//           <div className="flex gap-2 w-full">
//             <MessageButton userId={profile.id} />
//             <FollowButton userId={profile.id} initialFollowing={profile.isFollowedByViewer} />
//           </div>
//         )}
//       </div>
//       {/* Tabs + content */}
//       <div className="mt-1">
//         <ProfileTabs userId={profile.id} />
//       </div>
//     </main>
//   );
// }

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, Globe, Heart, MapPin, Star } from "lucide-react";
import { getPublicProfileWithSocial } from "@/lib/profile";
import { getOptionalUser } from "@/lib/guards";
import { FollowButton } from "@/components/follow-button";
import { MessageButton } from "@/components/message-button";
import { ProfileTabs } from "@/components/profile-tabs";
import { SuggestedUsers } from "@/components/suggested-users";
import { ProfileBackButton, ProfileShareButton, ProfileQrButton } from "@/components/profile-top-actions";
import { prisma, getUserRatingSummary } from "@/lib/db";
import { getUserTrust } from "@/lib/trust";
import {
  BADGE_LABEL,
  ROLE_LABEL as TRUST_ROLE_LABEL,
  TIER_LABEL,
  TIER_STYLE,
  tierFor,
  type TrustRoleCode,
} from "@/lib/trust-labels";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfileWithSocial(id, null);
  if (!profile) return { title: "Profile not found" };
  return {
    title: profile.companyName ? `${profile.name} · ${profile.companyName}` : profile.name,
    description: profile.bio ?? undefined,
  };
}

const ROLE_LABEL: Record<string, string> = {
  VENDOR: "Provider",
  BUSINESS: "Business",
  ADMIN: "Official xivago account",
};

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params;
  const viewer = await getOptionalUser();
  const profile = await getPublicProfileWithSocial(id, viewer?.id ?? null);
  if (!profile) notFound();

  const [ratingSummary, vendorRatings, seekerRatings, trust, recentRatings] = await Promise.all([
    getUserRatingSummary(prisma, profile.id),
    getUserRatingSummary(prisma, profile.id, "SEEKER_TO_VENDOR"),
    getUserRatingSummary(prisma, profile.id, "VENDOR_TO_SEEKER"),
    getUserTrust(profile.id),
    prisma.rating.findMany({
      where: { ratedUserId: profile.id, comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { comment: true, createdAt: true, rater: { select: { name: true, avatarUrl: true } } },
    }),
  ]);
  // Live per-role ratings next to each role's (monthly) tier.
  const roleRows = (
    [
      ["VENDOR", vendorRatings],
      ["SEEKER", seekerRatings],
    ] as const
  ).filter(([role, r]) => r.ratingCount > 0 || tierFor(trust.tiers, role as TrustRoleCode) !== "NEW");

  return (
    <main className="dark min-h-dvh bg-[#0a0a0a] pb-24 text-white">
      {/* ── HERO ── */}
      <div className="relative h-[56dvh] min-h-[430px] w-full overflow-hidden">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-95"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-900" />
        )}
        {/* scrim: darker top for the floating bar, fades to app background at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/15 to-[#0a0a0a]" />

        {/* floating top bar: back · centered name · heart + more */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <ProfileBackButton />
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            <span className="max-w-[200px] truncate text-base font-semibold text-white">
              {profile.name}
            </span>
            <span className="grid h-4 w-4 place-items-center rounded-full bg-mint text-[9px] font-black text-white">
              ✓
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/u/${profile.id}/followers`}
              aria-label="Followers"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition active:scale-95"
            >
              <Heart className="h-5 w-5" />
            </Link>
            {profile.isViewerSelf && <ProfileQrButton userId={profile.id} name={profile.name} />}
            <ProfileShareButton />
          </div>
        </div>

        {/* hero bottom content */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-5 pb-7">
          <h1 className="text-4xl font-bold tracking-tight text-white">{profile.name}</h1>
          {profile.username && <p className="mt-0.5 text-[15px] text-neutral-400">@{profile.username}</p>}
          <p className="mt-1.5 max-w-xs text-[15px] leading-5 text-neutral-300">
            {profile.companyName ?? ROLE_LABEL[profile.role] ?? profile.role}
            {profile.bio ? ` · ${profile.bio.split("\n")[0]}` : ""}
          </p>

          {/* stats */}
          <div className="mt-4 w-full flex justify-between items-center px-4 text-[15px]">
            <span className="font-bold text-white">{profile.followingCount} <span className="font-normal text-neutral-400">following</span></span>
            <span className="font-bold text-white">{profile.followerCount} <span className="font-normal text-neutral-400">{profile.followerCount === 1 ? "follower" : "followers"}</span></span>
            <span className="font-bold text-white">{profile.services.length} <span className="font-normal text-neutral-400">{profile.services.length === 1 ? "offer" : "offers"}</span></span>
          </div>

          {/* CTAs: white pill + plain text, like the image */}
          {!profile.isViewerSelf && (
            <div className="mt-5 flex justify-center items-center gap-5">
              <MessageButton userId={profile.id} />
              <FollowButton userId={profile.id} initialFollowing={profile.isFollowedByViewer} />
            </div>
          )}
        </div>
      </div>

      {/* ── people to follow, right under the header (like Instagram) ── */}
      <div className="relative z-20 mt-2 px-5">
        <SuggestedUsers profileId={profile.id} />
      </div>

      {/* ── floating segmented tabs (overlaps hero) ── */}
      <div className="relative z-20 mt-4 px-5">
        <ProfileTabs userId={profile.id} bio={profile.bio} services={profile.services} isSelf={profile.isViewerSelf} />
      </div>

      {/* meta row */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 text-sm text-neutral-500">
        {profile.location && (
          <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {profile.location}</span>
        )}
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-neutral-400 hover:text-white">
            <Globe className="h-4 w-4" /> {profile.website.replace(/^https?:\/\//, "")}
          </a>
        )}
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          Joined {new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </span>
      </div>

      {/* ── Rating / trust ── */}
      <div className="mt-5 px-5">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              <span className="text-lg font-bold text-white">
                {ratingSummary.overall != null ? ratingSummary.overall.toFixed(1) : "—"}
              </span>
              <span className="text-sm text-neutral-500">({ratingSummary.ratingCount} ratings)</span>
            </div>
            {roleRows.length === 0 && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_STYLE.NEW}`}>{TIER_LABEL.NEW}</span>
            )}
          </div>

          {roleRows.length > 0 && (
            <div className="mt-3 space-y-2">
              {roleRows.map(([role, r]) => {
                const tier = tierFor(trust.tiers, role);
                return (
                  <div key={role} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">
                      As {TRUST_ROLE_LABEL[role].toLowerCase()} ·{" "}
                      <span className="text-neutral-200">{r.overall != null ? r.overall.toFixed(1) : "—"}</span> ({r.ratingCount})
                    </span>
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${TIER_STYLE[tier]}`}>
                      {TRUST_ROLE_LABEL[role]} · {TIER_LABEL[tier]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {trust.badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {trust.badges.map((code) => (
                <span key={code} className="rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] font-medium text-neutral-200">
                  {BADGE_LABEL[code] ?? code}
                </span>
              ))}
            </div>
          )}

          {ratingSummary.ratingCount > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-400">
              <span>Responsiveness · {ratingSummary.responsiveness?.toFixed(1)}</span>
              <span>Quality · {ratingSummary.quality?.toFixed(1)}</span>
              <span>Timeliness · {ratingSummary.timeliness?.toFixed(1)}</span>
              <span>Value · {ratingSummary.value?.toFixed(1)}</span>
            </div>
          )}

          {recentRatings.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-neutral-800 pt-3">
              {recentRatings.map((r, i) => (
                <div key={i} className="text-sm text-neutral-300">
                  <span className="font-semibold text-neutral-100">{r.rater.name}</span>{" "}
                  <span className="text-neutral-400">{r.comment}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
