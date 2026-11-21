"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Bookmark, Check, FolderPlus, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DemandCardData } from "@/components/demand-card";
import type { ForumPost } from "@/components/forum/types";

export interface CollectionSummary {
  id: string;
  name: string;
  count: number;
  covers: string[];
}

export type SavedRef = { demandId: string } | { postId: string };

/** Instagram-style 2x2 cover; one photo fills the tile; none → soft placeholder. */
export function CoverMosaic({ covers, className }: { covers: string[]; className?: string }) {
  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-2xl bg-[#1c1c1e]", className)}>
      {covers.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
          <Bookmark className="h-9 w-9 text-white/25" />
        </div>
      ) : covers.length < 4 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={covers[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[2px]">
          {covers.slice(0, 4).map((c, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={c} alt="" className="h-full w-full object-cover" loading="lazy" />
          ))}
        </div>
      )}
    </div>
  );
}

export function CollectionTile({
  name,
  count,
  covers,
  onClick,
  index = 0,
}: {
  name: string;
  count: number;
  covers: string[];
  onClick: () => void;
  index?: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, delay: Math.min(index, 8) * 0.04 }}
      whileTap={{ scale: 0.97 }}
      className="text-left"
    >
      <CoverMosaic covers={covers} />
      <p className="mt-2 truncate text-[15px] font-semibold text-white">{name}</p>
      <p className="text-[12.5px] text-white/45">
        {count} item{count === 1 ? "" : "s"}
      </p>
    </motion.button>
  );
}

/** Bottom sheet shell shared by the collection dialogs. */
function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="sheet" className="fixed inset-0 z-[96] flex items-end justify-center">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[#161618] text-white ring-1 ring-white/10"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
          >
            <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-white/20" />
            <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-2.5">
              <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/10">
                <X className="h-5 w-5" />
              </button>
              <p className="text-[16px] font-semibold">{title}</p>
              <span className="w-9" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {footer && <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )}</>;
}

type Pickable = { ref: SavedRef; key: string; thumb: string | null; text: string };

async function loadSaved(): Promise<Pickable[]> {
  const [d, p] = await Promise.all([
    fetch("/api/bookmarks").then((r) => (r.ok ? r.json() : { demands: [] })),
    fetch("/api/forum/bookmarks").then((r) => (r.ok ? r.json() : { posts: [] })),
  ]);
  const posts: Pickable[] = (p.posts as ForumPost[]).map((x) => ({
    ref: { postId: x.id },
    key: `p:${x.id}`,
    thumb: x.attachments.find((a) => a.contentType.startsWith("image/"))?.url ?? null,
    text: x.text,
  }));
  const demands: Pickable[] = (d.demands as DemandCardData[]).map((x) => ({
    ref: { demandId: x.id },
    key: `d:${x.id}`,
    thumb: (x as unknown as { mediaUrls?: string[] }).mediaUrls?.[0] ?? null,
    text: x.summary,
  }));
  return [...posts, ...demands];
}

/** Pick saved items (grid with ticks), used when creating a collection or adding to one. */
function SavedPicker({ picked, onToggle, exclude }: { picked: string[]; onToggle: (p: Pickable) => void; exclude?: Set<string> }) {
  const [items, setItems] = useState<Pickable[] | null>(null);
  useEffect(() => {
    loadSaved().then(setItems).catch(() => setItems([]));
  }, []);
  if (!items) {
    return (
      <div className="flex justify-center py-10 text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  const shown = items.filter((i) => !exclude?.has(i.key));
  if (shown.length === 0) return <p className="px-6 py-10 text-center text-[14px] text-white/45">Nothing else saved yet.</p>;
  return (
    <div className="grid grid-cols-3 gap-[2px] px-[2px] pb-2">
      {shown.map((it) => {
        const on = picked.includes(it.key);
        return (
          <button key={it.key} type="button" onClick={() => onToggle(it)} className="relative aspect-square overflow-hidden bg-[#1c1c1e]">
            {it.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <p className="line-clamp-5 p-2 text-left text-[11.5px] leading-[15px] text-white/75">{it.text}</p>
            )}
            <motion.span
              animate={{ scale: on ? [1, 1.2, 1] : 1 }}
              className={cn(
                "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2",
                on ? "border-[#0A84FF] bg-[#0A84FF]" : "border-white/80 bg-black/30",
              )}
            >
              {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
            </motion.span>
            {on && <span className="absolute inset-0 bg-white/15" />}
          </button>
        );
      })}
    </div>
  );
}

/** New collection: name it, then (optionally) tick saved items to put in it. */
export function NewCollectionSheet({
  open,
  onClose,
  onCreated,
  seed,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: { id: string; name: string }) => void;
  /** Start with this item in the new collection (from "Save to collection"). */
  seed?: SavedRef | null;
}) {
  const [step, setStep] = useState<"name" | "pick">("name");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Array<{ key: string; ref: SavedRef }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("name");
    setName("");
    setPicked([]);
  }, [open]);

  async function create() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const items = [...(seed ? [seed] : []), ...picked.map((p) => p.ref)];
      const res = await fetch("/api/bookmarks/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), items }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not create the collection.");
        return;
      }
      toast.success(`“${data.collection.name}” created`);
      onCreated(data.collection);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step === "name" ? "New collection" : "Add from saved"}
      footer={
        step === "name" ? (
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => (seed ? void create() : setStep("pick"))}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0A84FF] text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : seed ? "Create" : "Next"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => void create()} className="h-12 flex-1 rounded-full bg-white/10 text-[15px] font-semibold">
              Skip
            </button>
            <button
              type="button"
              onClick={() => void create()}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#0A84FF] text-[15px] font-semibold text-white"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Done{picked.length ? ` (${picked.length})` : ""}
            </button>
          </div>
        )
      }
    >
      {step === "name" ? (
        <div className="flex flex-col items-center px-6 pb-6 pt-4">
          <motion.div initial={{ scale: 0.8, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
            <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#3B7BF8] to-[#A855F7]">
              <FolderPlus className="h-10 w-10" />
            </span>
          </motion.div>
          <input
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && (seed ? void create() : setStep("pick"))}
            placeholder="Collection name"
            className="mt-6 h-12 w-full rounded-xl bg-black/40 px-4 text-center text-[17px] outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-[#0A84FF]"
          />
        </div>
      ) : (
        <SavedPicker
          picked={picked.map((p) => p.key)}
          onToggle={(it) =>
            setPicked((prev) => (prev.some((p) => p.key === it.key) ? prev.filter((p) => p.key !== it.key) : [...prev, { key: it.key, ref: it.ref }]))
          }
        />
      )}
    </Sheet>
  );
}

/** "Add items" inside a collection. */
export function AddToCollectionSheet({
  open,
  onClose,
  collectionId,
  existing,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  existing: Set<string>;
  onAdded: () => void;
}) {
  const [picked, setPicked] = useState<Array<{ key: string; ref: SavedRef }>>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add to collection"
      footer={
        <button
          type="button"
          disabled={!picked.length || saving}
          onClick={async () => {
            setSaving(true);
            const res = await fetch(`/api/bookmarks/collections/${collectionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ add: picked.map((p) => p.ref) }),
            });
            setSaving(false);
            if (!res.ok) {
      toast.error("Could not add those items.");
      return;
    }
            onAdded();
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0A84FF] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Add{picked.length ? ` ${picked.length}` : ""}
        </button>
      }
    >
      <SavedPicker
        exclude={existing}
        picked={picked.map((p) => p.key)}
        onToggle={(it) =>
          setPicked((prev) => (prev.some((p) => p.key === it.key) ? prev.filter((p) => p.key !== it.key) : [...prev, { key: it.key, ref: it.ref }]))
        }
      />
    </Sheet>
  );
}

/** "Save to collection" from any saved item: pick a collection (or make one). */
export function CollectionPickerSheet({ item, onClose }: { item: SavedRef | null; onClose: () => void }) {
  const [list, setList] = useState<CollectionSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setList(null);
    fetch("/api/bookmarks/collections")
      .then((r) => (r.ok ? r.json() : { collections: [] }))
      .then((j) => setList(j.collections))
      .catch(() => setList([]));
  }, [item]);

  async function addTo(c: CollectionSummary) {
    if (!item || busy) return;
    setBusy(c.id);
    const res = await fetch(`/api/bookmarks/collections/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add: [item] }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error("Could not save to that collection.");
      return;
    }
    toast.success(`Saved to ${c.name}`);
    onClose();
  }

  return (
    <>
      <Sheet open={item !== null && !creating} onClose={onClose} title="Save to collection">
        <div className="pb-[max(env(safe-area-inset-bottom),16px)]">
          <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center gap-3 px-4 py-3 active:bg-white/5">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/[0.07]">
              <Plus className="h-6 w-6" />
            </span>
            <span className="text-[15px] font-semibold">New collection</span>
          </button>
          {list === null ? (
            <div className="flex justify-center py-8 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            list.map((c) => (
              <button key={c.id} type="button" onClick={() => void addTo(c)} className="flex w-full items-center gap-3 px-4 py-2.5 active:bg-white/5">
                <CoverMosaic covers={c.covers} className="h-14 w-14 rounded-xl" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px] font-medium">{c.name}</span>
                  <span className="block text-[12.5px] text-white/45">{c.count} items</span>
                </span>
                {busy === c.id && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
              </button>
            ))
          )}
        </div>
      </Sheet>
      <NewCollectionSheet
        open={item !== null && creating}
        seed={item}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          onClose();
        }}
      />
    </>
  );
}
