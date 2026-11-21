// // "use client";

// // import { useEffect, useState } from "react";
// // import Link from "next/link";
// // import { Loader2 } from "lucide-react";
// // import { cn } from "@/lib/utils";
// // import { formatBudgetRange } from "@/lib/money";
// // import { timeAgo } from "@/lib/time";
// // import { CountdownBadge } from "@/components/countdown-badge";
// // import { PriorityBadge } from "@/components/priority-badge";
// // import type { ForumPost } from "@/components/forum/types";
// // import { ForumPostCard } from "@/components/forum/forum-post-card";

// // interface ProfileDemand {
// //   id: string;
// //   summary: string;
// //   budgetMin: number | null;
// //   budgetMax: number | null;
// //   status: string;
// //   isPriority: boolean;
// //   timelineEnd: string;
// //   createdAt: string;
// //   _count: { bids: number };
// // }

// // type Tab = "threads" | "demands";

// // export function ProfileTabs({ userId }: { userId: string }) {
// //   const [tab, setTab] = useState<Tab>("threads");
// //   const [threads, setThreads] = useState<ForumPost[] | null>(null);
// //   const [demands, setDemands] = useState<ProfileDemand[] | null>(null);

// //   useEffect(() => {
// //     if (tab === "threads" && threads === null) {
// //       (async () => {
// //         const res = await fetch(`/api/forum?authorId=${userId}`);
// //         setThreads(res.ok ? (await res.json()).posts : []);
// //       })();
// //     }
// //     if (tab === "demands" && demands === null) {
// //       (async () => {
// //         const res = await fetch(`/api/users/${userId}/demands`);
// //         setDemands(res.ok ? (await res.json()).demands : []);
// //       })();
// //     }
// //   }, [tab, userId, threads, demands]);

// //   function updateThread(postId: string, updater: (post: ForumPost) => ForumPost) {
// //     setThreads((prev) => prev?.map((p) => (p.id === postId ? updater(p) : p)) ?? null);
// //   }
// //   function removeThread(postId: string) {
// //     setThreads((prev) => prev?.filter((p) => p.id !== postId) ?? null);
// //   }

// //   return (
// //     <div>
// //       <div className="mb-3 flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
// //         {(["threads", "demands"] as Tab[]).map((t) => (
// //           <button
// //             key={t}
// //             type="button"
// //             onClick={() => setTab(t)}
// //             className={cn(
// //               "flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-colors",
// //               tab === t ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white" : "text-neutral-500",
// //             )}
// //           >
// //             {t}
// //           </button>
// //         ))}
// //       </div>

// //       {tab === "threads" && (
// //         <div className="space-y-3">
// //           {threads === null && (
// //             <div className="flex justify-center py-8 text-neutral-400">
// //               <Loader2 className="h-5 w-5 animate-spin" />
// //             </div>
// //           )}
// //           {threads !== null && threads.length === 0 && (
// //             <p className="card-shell p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
// //               No feed posts yet.
// //             </p>
// //           )}
// //           {threads?.map((post) => (
// //             <ForumPostCard key={post.id} post={post} onUpdate={updateThread} onRemove={removeThread} />
// //           ))}
// //         </div>
// //       )}

// //       {tab === "demands" && (
// //         <div className="space-y-3">
// //           {demands === null && (
// //             <div className="flex justify-center py-8 text-neutral-400">
// //               <Loader2 className="h-5 w-5 animate-spin" />
// //             </div>
// //           )}
// //           {demands !== null && demands.length === 0 && (
// //             <p className="card-shell p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
// //               No requests or offers posted yet.
// //             </p>
// //           )}
// //           {demands?.map((d) => {
// //             const budgetLabel = formatBudgetRange(d.budgetMin, d.budgetMax);
// //             const card = (
// //               <div className={cn("card-shell p-4", d.status !== "OPEN" && "card-expired")}>
// //                 <div className="mb-2 flex items-center justify-between gap-2">
// //                   {d.isPriority ? <PriorityBadge /> : <span />}
// //                   {d.status === "OPEN" ? (
// //                     <CountdownBadge timelineEnd={d.timelineEnd} />
// //                   ) : (
// //                     <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-400 dark:bg-neutral-800">
// //                       {d.status}
// //                     </span>
// //                   )}
// //                 </div>
// //                 <p className="mb-2 line-clamp-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
// //                   {d.summary}
// //                 </p>
// //                 <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
// //                   {budgetLabel && <span className="font-semibold text-neutral-700 dark:text-neutral-300">{budgetLabel}</span>}
// //                   <span>{d._count.bids}/3 spots filled</span>
// //                   <span>{timeAgo(d.createdAt)}</span>
// //                 </div>
// //               </div>
// //             );
// //             return d.status === "OPEN" ? (
// //               <Link key={d.id} href={`/demands/${d.id}`}>
// //                 {card}
// //               </Link>
// //             ) : (
// //               <div key={d.id}>{card}</div>
// //             );
// //           })}
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// "use client";

// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { LayoutGrid, Loader2, MessageSquare } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { formatBudgetRange } from "@/lib/money";
// import { timeAgo } from "@/lib/time";
// import { CountdownBadge } from "@/components/countdown-badge";
// import { PriorityBadge } from "@/components/priority-badge";
// import type { ForumPost } from "@/components/forum/types";
// import { ForumPostCard } from "@/components/forum/forum-post-card";

// interface ProfileDemand {
//   id: string;
//   summary: string;
//   budgetMin: number | null;
//   budgetMax: number | null;
//   status: string;
//   isPriority: boolean;
//   timelineEnd: string;
//   createdAt: string;
//   _count: { bids: number };
// }

// type Tab = "threads" | "demands";

// const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
//   { id: "threads", label: "Feed", icon: MessageSquare },
//   { id: "demands", label: "Demands", icon: LayoutGrid },
// ];

// export function ProfileTabs({ userId }: { userId: string }) {
//   const [tab, setTab] = useState<Tab>("threads");
//   const [threads, setThreads] = useState<ForumPost[] | null>(null);
//   const [demands, setDemands] = useState<ProfileDemand[] | null>(null);

//   useEffect(() => {
//     if (tab === "threads" && threads === null) {
//       (async () => {
//         const res = await fetch(`/api/forum?authorId=${userId}`);
//         setThreads(res.ok ? (await res.json()).posts : []);
//       })();
//     }
//     if (tab === "demands" && demands === null) {
//       (async () => {
//         const res = await fetch(`/api/users/${userId}/demands`);
//         setDemands(res.ok ? (await res.json()).demands : []);
//       })();
//     }
//   }, [tab, userId, threads, demands]);

//   function updateThread(postId: string, updater: (post: ForumPost) => ForumPost) {
//     setThreads((prev) => prev?.map((p) => (p.id === postId ? updater(p) : p)) ?? null);
//   }
//   function removeThread(postId: string) {
//     setThreads((prev) => prev?.filter((p) => p.id !== postId) ?? null);
//   }

//   return (
//     <div>
//       {/* X-style tab bar: icon + label, active = brand underline */}
//       <div className="flex border-b border-neutral-200 dark:border-neutral-800">
//         {TABS.map(({ id, label, icon: Icon }) => (
//           <button
//             key={id}
//             type="button"
//             onClick={() => setTab(id)}
//             className={cn(
//               "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors",
//               tab === id
//                 ? "-mb-px border-b-2 border-brand-500 text-neutral-900 dark:text-neutral-50"
//                 : "text-neutral-500 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-900",
//             )}
//           >
//             <Icon className="h-4 w-4" />
//             {label}
//           </button>
//         ))}
//       </div>

//       {tab === "threads" && (
//         <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
//           {threads === null && (
//             <div className="flex justify-center py-8 text-neutral-400">
//               <Loader2 className="h-5 w-5 animate-spin" />
//             </div>
//           )}
//           {threads !== null && threads.length === 0 && (
//             <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">No feed posts yet.</p>
//           )}
//           {threads?.map((post) => (
//             <ForumPostCard key={post.id} post={post} onUpdate={updateThread} onRemove={removeThread} />
//           ))}
//         </div>
//       )}

//       {tab === "demands" && (
//         <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
//           {demands === null && (
//             <div className="flex justify-center py-8 text-neutral-400">
//               <Loader2 className="h-5 w-5 animate-spin" />
//             </div>
//           )}
//           {demands !== null && demands.length === 0 && (
//             <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
//               No requests or offers posted yet.
//             </p>
//           )}
//           {demands?.map((d) => {
//             const budgetLabel = formatBudgetRange(d.budgetMin, d.budgetMax);
//             const body = (
//               <article className={cn("px-4 py-3", d.status !== "OPEN" && "opacity-60")}>
//                 <div className="mb-1.5 flex items-center justify-between gap-2">
//                   {d.isPriority ? (
//                     <PriorityBadge />
//                   ) : (
//                     d.status !== "OPEN" && (
//                       <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-400 dark:bg-neutral-800">
//                         {d.status}
//                       </span>
//                     )
//                   )}
//                   {d.status === "OPEN" && <CountdownBadge timelineEnd={d.timelineEnd} />}
//                 </div>
//                 <p className="line-clamp-2 text-[15px] font-medium leading-6 text-neutral-900 dark:text-neutral-100">
//                   {d.summary}
//                 </p>
//                 <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
//                   {budgetLabel && (
//                     <span className="font-semibold text-neutral-700 dark:text-neutral-300">{budgetLabel}</span>
//                   )}
//                   <span>{d._count.bids}/3 spots filled</span>
//                   <span>{timeAgo(d.createdAt)}</span>
//                 </div>
//               </article>
//             );
//             return d.status === "OPEN" ? (
//               <Link key={d.id} href={`/demands/${d.id}`} className="block">
//                 {body}
//               </Link>
//             ) : (
//               <div key={d.id}>{body}</div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBudgetRange } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { CountdownBadge } from "@/components/countdown-badge";
import { PriorityBadge } from "@/components/priority-badge";
import type { ForumPost } from "@/components/forum/types";
import { ForumPostCard } from "@/components/forum/forum-post-card";
import { MaskedBio } from "@/components/profile-bio";
import { ProfileCommunities } from "@/components/profile-communities";

interface ProfileDemand {
  id: string;
  summary: string;
  budgetMin: number | null;
  budgetMax: number | null;
  status: string;
  isPriority: boolean;
  timelineEnd: string;
  createdAt: string;
  _count: { bids: number };
}

type Tab = "threads" | "demands" | "communities";

const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "threads", label: "Feed", icon: MessageSquare },
  // Demands tab hidden from public profiles:
  // { id: "demands", label: "Demands", icon: LayoutGrid },
  { id: "communities", label: "Communities", icon: LayoutGrid },

];

export function ProfileTabs({
  userId,
  bio,
  services = [],
  isSelf = false,
}: {
  userId: string;
  bio?: string | null;
  services?: string[];
  isSelf?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("threads");
  const [threads, setThreads] = useState<ForumPost[] | null>(null);
  const [demands, setDemands] = useState<ProfileDemand[] | null>(null);

  useEffect(() => {
    if (tab === "threads" && threads === null) {
      (async () => {
        const res = await fetch(`/api/forum?authorId=${userId}`);
        setThreads(res.ok ? (await res.json()).posts : []);
      })();
    }
    if (tab === "demands" && demands === null) {
      (async () => {
        const res = await fetch(`/api/users/${userId}/demands`);
        setDemands(res.ok ? (await res.json()).demands : []);
      })();
    }
  }, [tab, userId, threads, demands]);

  function updateThread(postId: string, updater: (post: ForumPost) => ForumPost) {
    setThreads((prev) => prev?.map((p) => (p.id === postId ? updater(p) : p)) ?? null);
  }
  function removeThread(postId: string) {
    setThreads((prev) => prev?.filter((p) => p.id !== postId) ?? null);
  }

  return (
    <div>
      {/* Segmented floating pill — Overview/Words/Grammar/Culture style */}
      <div className="mx-auto flex max-w-md rounded-full bg-[#111] p-0 px-0 shadow-2xl backdrop-blur">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors",
              tab === id
                ? "bg-[#121212] border border-white/10  text-white"
                : "text-neutral-500 hover:text-neutral-300",
            )}
          >
            {/* <Icon className="h-4 w-4" /> */}
            {label}
          </button>
        ))}
      </div>

      {/* About — masked bio like the image */}
      {bio && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-white">About</h2>
          <MaskedBio bio={bio} />
        </section>
      )}

      {/* Services — "Popular words" style row */}
      {services.length > 0 && (
        <section className="mt-5">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Services</h2>
            <span className="text-sm font-semibold text-sapphire">See all</span>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {services.map((s) => (
              <span
                key={s}
                className="shrink-0 rounded-2xl border border-white/10 bg-neutral-900 px-3.5 py-2 text-xs font-medium text-neutral-300"
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Tab content */}
      <div className="mt-6">
        {tab === "threads" && (
          <div className="divide-y divide-white/5 rounded-3xl border border-white/5 bg-neutral-950/60">
            {threads === null && (
              <div className="flex justify-center py-8 text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {threads !== null && threads.length === 0 && (
              <p className="py-10 text-center text-sm text-neutral-500">No feed posts yet.</p>
            )}
            {threads?.map((post) => (
              <ForumPostCard key={post.id} post={post} onUpdate={updateThread} onRemove={removeThread} />
            ))}
          </div>
        )}

        {tab === "communities" && (
          <ProfileCommunities userId={userId} isSelf={isSelf} />
        )}

        {/* Demands tab is hidden (see TABS); its content stays here for when it returns. */}
        {tab === "demands" && (
          <div className="divide-y divide-white/5 rounded-3xl border border-white/5 bg-neutral-950/60">
            {demands === null && (
              <div className="flex justify-center py-8 text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {demands !== null && demands.length === 0 && (
              <p className="py-10 text-center text-sm text-neutral-500">No requests or offers posted yet.</p>
            )}
            {demands?.map((d) => {
              const budgetLabel = formatBudgetRange(d.budgetMin, d.budgetMax);
              const body = (
                <article className={cn("px-4 py-3", d.status !== "OPEN" && "opacity-60")}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    {d.isPriority ? (
                      <PriorityBadge />
                    ) : (
                      d.status !== "OPEN" && (
                        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-neutral-400">
                          {d.status}
                        </span>
                      )
                    )}
                    {d.status === "OPEN" && <CountdownBadge timelineEnd={d.timelineEnd} />}
                  </div>
                  <p className="line-clamp-2 text-[15px] font-medium leading-6 text-neutral-100">
                    {d.summary}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    {budgetLabel && <span className="font-semibold text-neutral-300">{budgetLabel}</span>}
                    <span>{d._count.bids}/3 spots filled</span>
                    <span>{timeAgo(d.createdAt)}</span>
                  </div>
                </article>
              );
              return d.status === "OPEN" ? (
                <Link key={d.id} href={`/demands/${d.id}`} className="block">
                  {body}
                </Link>
              ) : (
                <div key={d.id}>{body}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}