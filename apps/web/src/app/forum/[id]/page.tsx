"use client";

import { Suspense } from "react";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, MessageCircle, Users } from "lucide-react";
import { CommentThread } from "@/components/forum/comment-thread";
import { PostMedia, PostPoll, PostText } from "@/components/forum/post-content";
import { ReactionBar } from "@/components/forum/reaction-bar";
import { ReportMenu } from "@/components/forum/report-menu";
import { useForumPost } from "@/components/forum/use-forum-post";
import { usePostActions } from "@/components/forum/use-post-actions";
import { PostEngagementButtons } from "@/components/forum/post-engagement-buttons";
import { formatCount } from "@/lib/format-count";
import type { ForumPost } from "@/components/forum/types";

function postedAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${time} · ${date}`;
}

function PostHeader({ onBack, actions }: { onBack: () => void; actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[3rem_1fr_3rem] items-center bg-black/80 px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-xl">
      <button type="button" onClick={onBack} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full text-white active:bg-white/10">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="text-center text-[17px] font-semibold text-white">Post</h1>
      <div className="flex justify-end pr-2">{actions}</div>
    </header>
  );
}

function PostBody({ post, onUpdate, onRemove }: { post: ForumPost; onUpdate: (id: string, updater: (p: ForumPost) => ForumPost) => void; onRemove: (id: string) => void }) {
  const actions = usePostActions(post, onUpdate, onRemove);
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <>
      <PostHeader
        onBack={() => (window.history.length > 1 ? router.back() : router.push("/forum"))}
        actions={<ReportMenu canDelete={post.isMine} onDelete={actions.remove} onReport={actions.report} />}
      />

      <article className="border-b border-neutral-800 px-4 pb-1 pt-2">
        {post.community && (
          <Link href={`/communities/${post.community.id}`} className="mb-2 flex w-fit max-w-full items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">{post.community.name}</span>
          </Link>
        )}

        <Link href={`/u/${post.sender.id}`} className="flex w-fit max-w-full items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.sender.avatarUrl ?? "/icons/avatar-placeholder.svg"} alt={post.sender.name} className="h-11 w-11 shrink-0 rounded-full bg-neutral-800 object-cover" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[16px] font-semibold text-white">{post.sender.companyName ?? post.sender.name}</span>
            {post.sender.companyName && <span className="block truncate text-sm text-neutral-500">{post.sender.name}</span>}
          </span>
        </Link>

        <p className="mt-3 whitespace-pre-wrap break-words text-[17px] leading-[1.45] text-white">
          <PostText text={post.text} />
        </p>

        {post.location && (
          <a
            href={`https://www.google.com/maps?q=${post.location.lat},${post.location.lng}`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 flex w-fit items-center gap-1 text-xs text-neutral-400 hover:text-brand-600"
          >
            <MapPin className="h-3.5 w-3.5" /> Nearby
          </a>
        )}

        <PostMedia post={post} className="mt-3" bleedClassName="-mx-4 px-4 scroll-pl-4" />
        {post.poll && <PostPoll poll={post.poll} onVote={actions.vote} className="mt-3" />}

        <p className="mt-3 text-sm text-neutral-500">{postedAt(post.createdAt)}</p>

        <div className="mt-1 flex items-center justify-between gap-4 border-t border-neutral-800 px-1 py-1.5">
          <span className="flex items-center gap-1.5 text-neutral-400">
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm tabular-nums">{formatCount(post.commentCount)}</span>
          </span>
          <ReactionBar
            counts={post.reactions.counts}
            total={post.reactions.total}
            myReaction={post.reactions.myReaction}
            onReact={actions.react}
            onRemove={actions.unreact}
          />
          <PostEngagementButtons post={post} actions={actions} size={20} countClassName="text-sm" />
        </div>
      </article>

      <CommentThread
        postId={post.id}
        layout="page"
        onCountChange={actions.changeCommentCount}
        focusCommentId={searchParams.get("comment")}
      />
    </>
  );
}

// useSearchParams needs a Suspense boundary so the page can prerender.
export default function ForumPostPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-black" />}>
      <ForumPostPageInner />
    </Suspense>
  );
}

function ForumPostPageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { post, isLoading, isError, update, removeFromFeed } = useForumPost(id);

  function handleRemoved(postId: string) {
    removeFromFeed(postId);
    router.replace("/forum");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-black pb-20 text-white">
      {post ? (
        <PostBody post={post} onUpdate={update} onRemove={handleRemoved} />
      ) : (
        <>
          <PostHeader onBack={() => router.push("/forum")} />
          {isLoading ? (
            <div className="flex justify-center py-16 text-neutral-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <p className="px-6 py-16 text-center text-sm text-neutral-500">
              {isError ? "Could not load this post. Please try again." : "This post doesn't exist or was deleted."}
            </p>
          )}
        </>
      )}
    </main>
  );
}
