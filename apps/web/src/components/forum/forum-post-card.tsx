// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { toast } from "sonner";
// import { MessageCircle } from "lucide-react";
// import { ReactionBar } from "./reaction-bar";
// import { ReportMenu } from "./report-menu";
// import { CommentThread } from "./comment-thread";
// import { timeAgo } from "@/lib/time";
// import { bumpReaction, clearMyReaction } from "@/lib/forum-client";
// import type { ForumPost } from "./types";

// interface ForumPostCardProps {
//   post: ForumPost;
//   onUpdate: (postId: string, updater: (post: ForumPost) => ForumPost) => void;
//   onRemove: (postId: string) => void;
// }

// export function ForumPostCard({ post, onUpdate, onRemove }: ForumPostCardProps) {
//   const [commentsOpen, setCommentsOpen] = useState(false);

//   async function handleReact(emoji: string) {
//     const res = await fetch(`/api/forum/${post.id}/react`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ emoji }),
//     });
//     if (!res.ok) return;
//     onUpdate(post.id, (p) => ({ ...p, reactions: bumpReaction(p.reactions, emoji) }));
//   }

//   async function handleRemoveReaction() {
//     await fetch(`/api/forum/${post.id}/react`, { method: "DELETE" });
//     onUpdate(post.id, (p) => ({ ...p, reactions: clearMyReaction(p.reactions) }));
//   }

//   async function handleDelete() {
//     const res = await fetch(`/api/forum/${post.id}`, { method: "DELETE" });
//     if (!res.ok) {
//       toast.error("Could not delete this post.");
//       return;
//     }
//     onRemove(post.id);
//   }

//   async function handleReport(reason: string) {
//     await fetch(`/api/forum/${post.id}/report`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ reason }),
//     });
//   }

//   return (
//     <div className="overflow-hidden">
//       <div className="px-2 py-2">
//         <div className="mb-2 flex items-start justify-between gap-2">
//           <Link href={`/u/${post.sender.id}`} className="flex items-center gap-2.5">
//             {/* eslint-disable-next-line @next/next/no-img-element */}
//             <img
//               src={post.sender.avatarUrl ?? "/icons/avatar-placeholder.svg"}
//               alt={post.sender.name}
//               className="h-9 w-9 rounded-full bg-neutral-100 object-cover"
//             />
//             <div>
//               <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
//                 {post.sender.companyName ?? post.sender.name}
//               </p>
//               <span className="text-xs text-neutral-400">{timeAgo(post.createdAt)}</span>
//             </div>
//           </Link>
//           <ReportMenu canDelete={post.isMine} onDelete={handleDelete} onReport={handleReport} />
//         </div>

//         <p className="whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">
//           {post.text}
//         </p>

//         {post.attachment && (
//           <div className="mt-2.5 overflow-hidden rounded-xl">
//             {/* eslint-disable-next-line @next/next/no-img-element */}
//             <img src={post.attachment.url} alt="" className="max-h-96 w-full object-cover" />
//           </div>
//         )}
//       </div>

//       <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2 dark:border-neutral-800">
//         <ReactionBar
//           counts={post.reactions.counts}
//           total={post.reactions.total}
//           myReaction={post.reactions.myReaction}
//           onReact={handleReact}
//           onRemove={handleRemoveReaction}
//         />
//         <button
//           type="button"
//           onClick={() => setCommentsOpen((v) => !v)}
//           className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
//         >
//           <MessageCircle className="h-3.5 w-3.5" />
//           {post.commentCount > 0 ? post.commentCount : ""} {post.commentCount === 1 ? "reply" : "replies"}
//         </button>
//       </div>

//       {commentsOpen && <CommentThread postId={post.id} />}
//     </div>
//   );
// }

"use client";

import { haptic } from "@/lib/haptics";
import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, MapPin, Users } from "lucide-react";
import { ReactionBar } from "./reaction-bar";
import { ReportMenu } from "./report-menu";
import { CommentThread } from "./comment-thread";
import { PostMedia, PostPoll, PostText } from "./post-content";
import { usePostActions } from "./use-post-actions";
import { PostEngagementButtons } from "./post-engagement-buttons";
import { formatCount } from "@/lib/format-count";
import { timeAgo } from "@/lib/time";
import type { ForumPost } from "./types";

interface ForumPostCardProps {
  post: ForumPost;
  onUpdate: (postId: string, updater: (post: ForumPost) => ForumPost) => void;
  onRemove: (postId: string) => void;
  /** Set on a community's own page, where naming the community is redundant. */
  hideCommunity?: boolean;
}

export function ForumPostCard({ post, onUpdate, onRemove, hideCommunity }: ForumPostCardProps) {
  const router = useRouter();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const actions = usePostActions(post, onUpdate, onRemove);

  /** Tapping the text or empty space opens the post; controls keep their own behaviour. */
  function openPost(e: MouseEvent<HTMLElement>) {
    // Clicks inside portals (the share drawer) bubble here through React but aren't in the card.
    if (!e.currentTarget.contains(e.target as Node)) return;
    if ((e.target as Element).closest("a, button, input, textarea, video, [data-post-no-open]")) return;
    if (window.getSelection()?.toString()) return; // they were selecting text
    void haptic("light");
    router.push(`/forum/${post.id}`);
  }

  return (
    <article onClick={openPost} className="cursor-pointer px-4 pt-3">
      <div className="flex gap-3">
        <Link href={`/u/${post.sender.id}`} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.sender.avatarUrl ?? "/icons/avatar-placeholder.svg"}
            alt={post.sender.name}
            className="h-9 w-9 rounded-full bg-neutral-100 object-cover dark:bg-neutral-800"
          />
        </Link>

        <div className="min-w-0 flex-1">
         
          {/* name + time + "..." */}
          <div className="flex !items-start justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <Link
                href={`/u/${post.sender.id}`}
                className="truncate text-[15px] font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
              >
                {post.sender.companyName ?? post.sender.name}
              </Link>
              <Link href={`/forum/${post.id}`} className="shrink-0 text-sm text-neutral-400 hover:underline">
                {timeAgo(post.createdAt)}
              </Link>
               {post.community && !hideCommunity && (
            <Link
              href={`/communities/${post.community.id}`}
              className="mb-0.5 flex w-fit max-w-full items-center gap-1 text-xs font-semibold text-brand-400 hover:underline"
            >
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">{post.community.name}</span>
            </Link>
          )}
            </div>
            <ReportMenu canDelete={post.isMine} onDelete={actions.remove} onReport={actions.report} />
          </div>

          <p className="-mt-6 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-900 dark:text-neutral-100">
            <PostText text={post.text} />
          </p>

          {post.location && (
            <a
              href={`https://www.google.com/maps?q=${post.location.lat},${post.location.lng}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-brand-600"
            >
              <MapPin className="h-3.5 w-3.5" /> Nearby
            </a>
          )}

          {/* 64px = the card's padding, avatar and gap: lets a swipe row reach the screen edges */}
          <PostMedia post={post} className="mt-2.5" bleedClassName="-ml-16 -mr-4 pl-16 pr-4 scroll-pl-16" />

          {post.poll && <PostPoll poll={post.poll} onVote={actions.vote} className="mt-2.5" />}

          {/* Threads-style action row */}
          <div data-post-no-open className="mt-0.5 flex w-full items-center justify-between gap-3 pr-2">
            <ReactionBar
              counts={post.reactions.counts}
              total={post.reactions.total}
              myReaction={post.reactions.myReaction}
              onReact={actions.react}
              onRemove={actions.unreact}
            />
            <button
              type="button"
              onClick={() => { void haptic("light"); setCommentsOpen((v) => !v); }}
              className="flex items-center gap-1.5 text-neutral-400 transition-colors hover:text-brand-600"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
              {post.commentCount > 0 && <span className="text-xs tabular-nums">{formatCount(post.commentCount)}</span>}
            </button>
            <PostEngagementButtons post={post} actions={actions} />
          </div>
        </div>
      </div>

      {commentsOpen && (
        <div data-post-no-open className="cursor-auto">
          <CommentThread postId={post.id} onCountChange={actions.changeCommentCount} />
        </div>
      )}
    </article>
  );
}
