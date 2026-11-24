"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, FileText, Loader2, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { BookmarksList } from "@/components/bookmarks-list";
import { SavedPostsList } from "@/components/saved-posts-list";
import { DemandCard, type DemandCardData } from "@/components/demand-card";
import { ForumPostCard } from "@/components/forum/forum-post-card";
import type { ForumPost } from "@/components/forum/types";
import { HaloTabs, HaloTabsContent, HaloTabsIndicator, HaloTabsList, HaloTabsTrigger } from "@/components/ui/halo-tabs";
import {
  AddToCollectionSheet,
  CollectionPickerSheet,
  CollectionTile,
  NewCollectionSheet,
  type CollectionSummary,
  type SavedRef,
} from "@/components/bookmarks/collections";

const TABS = [
  { id: "demands", label: "Requests", icon: FileText },
  { id: "posts", label: "Feed posts", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function BookmarksPage() {
  // useSearchParams needs a Suspense boundary on a statically rendered route.
  return (
    <Suspense fallback={<main className="min-h-dvh bg-black" />}>
      <Bookmarks />
    </Suspense>
  );
}

/**
 * Saved (Instagram layout): a grid of collections led by "All saved". Opening
 * a tile shows what's in it; the + makes a new collection. Collections are
 * optional -- saving still works exactly as before.
 */
function Bookmarks() {
  const router = useRouter();
  const params = useSearchParams();
  // Old links used ?tab=posts for the saved-posts list.
  const view = params.get("view") ?? (params.get("tab") === "posts" ? "posts" : null);
  const collectionId = params.get("c");
  const [data, setData] = useState<{ all: { count: number; covers: string[] }; collections: CollectionSummary[] } | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/bookmarks/collections");
    if (res.ok) setData(await res.json());
    else setData({ all: { count: 0, covers: [] }, collections: [] });
  }, []);

  useEffect(() => {
    void load();
  }, [load, view, collectionId]);

  const go = (qs: string) => router.push(qs ? `/bookmarks?${qs}` : "/bookmarks", { scroll: false });

  if (view === "all" || view === "posts") return <AllSaved onBack={() => go("")} initialTab={view === "posts" ? "posts" : "demands"} />;
  if (collectionId) return <CollectionDetail id={collectionId} onBack={() => go("")} onChanged={load} />;

  return (
    <main className="min-h-dvh bg-black px-4 pb-10 text-white">
      <header className="sticky top-0 z-30 -mx-4 grid grid-cols-[3rem_1fr_3rem] items-center bg-black/80 px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-center text-[17px] font-semibold">Saved</h1>
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={() => setNewOpen(true)}
          aria-label="New collection"
          className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      </header>

      {!data ? (
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square animate-pulse rounded-2xl bg-white/[0.06]" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
            <CollectionTile name="All saved" count={data.all.count} covers={data.all.covers} onClick={() => go("view=all")} />
            {data.collections.map((c, i) => (
              <CollectionTile key={c.id} name={c.name} count={c.count} covers={c.covers} index={i + 1} onClick={() => go(`c=${c.id}`)} />
            ))}
          </div>
          {data.collections.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 rounded-2xl bg-white/[0.04] p-5 text-center ring-1 ring-white/[0.06]"
            >
              <p className="text-[15px] font-semibold">Organise what you save</p>
              <p className="mt-1 text-[13px] text-white/50">Group saved requests and posts into collections — only you can see them.</p>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="mt-4 rounded-full bg-white px-5 py-2 text-[14px] font-semibold text-black active:scale-95"
              >
                New collection
              </button>
            </motion.div>
          )}
        </>
      )}

      <NewCollectionSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(c) => {
          setNewOpen(false);
          void load();
          go(`c=${c.id}`);
        }}
      />
    </main>
  );
}

function AllSaved({ onBack, initialTab }: { onBack: () => void; initialTab: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [collect, setCollect] = useState<SavedRef | null>(null);
  return (
    <main className="min-h-dvh bg-black px-3 pb-10 text-white">
      <header className="sticky top-0 z-30 -mx-3 grid grid-cols-[3rem_1fr_3rem] items-center bg-black/80 px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-xl">
        <button type="button" onClick={onBack} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-center text-[17px] font-semibold">All saved</h1>
      </header>

      <HaloTabs className="w-full gap-4" value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <HaloTabsList variant="pill" className="w-full rounded-full border border-white/[0.12] p-1 backdrop-blur-2xl">
          {TABS.map(({ id, label, icon: Icon }) => (
            <HaloTabsTrigger key={id} value={id} className="min-h-[38px] flex-1 gap-1.5 text-[14px] font-semibold text-white/60 data-active:text-black">
              <Icon className="h-4 w-4" strokeWidth={2.4} />
              {label}
            </HaloTabsTrigger>
          ))}
          <HaloTabsIndicator variant="pill" className="rounded-full bg-white [&>span]:hidden" />
        </HaloTabsList>
        <HaloTabsContent value="demands">
          <BookmarksList onCollect={(demandId) => setCollect({ demandId })} />
        </HaloTabsContent>
        <HaloTabsContent value="posts">
          <SavedPostsList onCollect={(postId) => setCollect({ postId })} />
        </HaloTabsContent>
      </HaloTabs>

      <CollectionPickerSheet item={collect} onClose={() => setCollect(null)} />
    </main>
  );
}

function CollectionDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ collection: { id: string; name: string }; demands: DemandCardData[]; posts: ForumPost[] } | null>(null);
  const [missing, setMissing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookmarks/collections/${id}`);
    if (!res.ok) {
      setMissing(true);
      return;
    }
    setData(await res.json());
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: object, ok?: string) {
    const res = await fetch(`/api/bookmarks/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(j?.error?.message ?? "Something went wrong.");
      return false;
    }
    if (ok) toast.success(ok);
    await load();
    onChanged();
    return true;
  }

  async function remove() {
    if (!window.confirm(`Delete “${data?.collection.name}”? Items stay in All saved.`)) return;
    const res = await fetch(`/api/bookmarks/collections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete the collection.");
      return;
    }
    toast.success("Collection deleted");
    onChanged();
    onBack();
  }

  const existing = new Set([...(data?.demands ?? []).map((d) => `d:${d.id}`), ...(data?.posts ?? []).map((p) => `p:${p.id}`)]);
  const empty = data && data.demands.length === 0 && data.posts.length === 0;

  return (
    <main className="min-h-dvh bg-black px-3 pb-10 text-white">
      <header className="sticky top-0 z-30 -mx-3 grid grid-cols-[3rem_1fr_3rem] items-center bg-black/80 px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-xl">
        <button type="button" onClick={onBack} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-center text-[17px] font-semibold">{data?.collection.name ?? ""}</h1>
        {data && (
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label="Collection options" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    style={{ transformOrigin: "top right" }}
                    className="absolute right-1 top-12 z-20 w-52 overflow-hidden rounded-2xl bg-[#2a2a2e] py-1 shadow-2xl ring-1 ring-white/10"
                  >
                    {[
                      { label: "Add items", icon: Plus, run: () => setAddOpen(true) },
                      { label: "Rename", icon: Pencil, run: () => setRenaming(data.collection.name) },
                      { label: "Delete collection", icon: Trash2, run: () => void remove(), danger: true },
                    ].map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          o.run();
                        }}
                        className={`flex h-11 w-full items-center justify-between px-4 text-[15px] active:bg-white/10 ${o.danger ? "text-[#FF453A]" : ""}`}
                      >
                        {o.label}
                        <o.icon className="h-4 w-4" />
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </header>

      <AnimatePresence>
        {renaming !== null && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onSubmit={async (e) => {
              e.preventDefault();
              if (renaming.trim() && (await patch({ name: renaming.trim() }, "Renamed"))) setRenaming(null);
            }}
          >
            <div className="mb-3 flex gap-2">
              <input
                autoFocus
                value={renaming}
                maxLength={60}
                onChange={(e) => setRenaming(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-xl bg-[#1c1c1e] px-3 text-[16px] outline-none ring-1 ring-white/10 focus:ring-[#0A84FF]"
              />
              <button type="submit" className="rounded-xl bg-[#0A84FF] px-4 text-[14px] font-semibold">
                Save
              </button>
              <button type="button" onClick={() => setRenaming(null)} aria-label="Cancel" className="rounded-xl bg-white/10 px-3">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {missing && <p className="py-16 text-center text-sm text-white/50">This collection no longer exists.</p>}
      {!data && !missing && (
        <div className="flex justify-center py-16 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {empty && (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-[17px] font-semibold">Start collecting</p>
          <p className="mt-1 text-[14px] text-white/50">Add requests and posts you&apos;ve saved.</p>
          <button type="button" onClick={() => setAddOpen(true)} className="mt-5 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black active:scale-95">
            Add items
          </button>
        </div>
      )}

      {data && !empty && (
        <div className="space-y-4">
          {data.posts.map((post) => (
            <div key={post.id} className="relative">
              <ForumPostCard post={post} onUpdate={() => void load()} onRemove={() => void load()} />
              <button
                type="button"
                onClick={() => void patch({ remove: [{ postId: post.id }] }, "Removed from collection")}
                aria-label="Remove from collection"
                className="absolute right-12 top-3 z-10 rounded-full bg-neutral-800/90 p-2 text-white backdrop-blur"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {data.demands.map((d) => (
            <div key={d.id} className="relative">
              <DemandCard demand={d} />
              <button
                type="button"
                onClick={() => void patch({ remove: [{ demandId: d.id }] }, "Removed from collection")}
                aria-label="Remove from collection"
                className="absolute right-3 top-3 z-10 rounded-full bg-neutral-800/90 p-2 text-white backdrop-blur"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddToCollectionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        collectionId={id}
        existing={existing}
        onAdded={() => {
          setAddOpen(false);
          toast.success("Added to collection");
          void load();
          onChanged();
        }}
      />
    </main>
  );
}
