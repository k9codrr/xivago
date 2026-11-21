"use client";

import { ENTER_ADDS_LINE } from "@/components/ui/composer-textarea";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { Check, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { mentionHandle, type MentionSuggestion, type MentionUser } from "./types";

/** "@" + the partial handle right before the caret, at the start of the text or after whitespace. */
const MENTION_TOKEN = /(?:^|\s)@([a-z0-9_-]{0,40})$/i;
/** Wait this long after typing before asking the server for suggestions. */
const FETCH_DEBOUNCE_MS = 120;

interface ActiveMention {
  /** Index of the "@" in the text. */
  start: number;
  /** What's been typed after the "@" so far. */
  query: string;
}

export interface MentionTextareaHandle {
  focus: () => void;
  /** Inserts "@" at the caret (with a leading space if needed) and opens the suggestions. */
  startMention: () => void;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
  /** Extra classes for the suggestion list. */
  listClassName?: string;
}

/** Suggestions are cached per query for the life of the page, so backspacing is instant. */
const cache = new Map<string, MentionSuggestion[]>();

/**
 * Textarea that suggests people and communities while typing "@name", like
 * Threads / X. People you follow or who follow you come first (matched on
 * username, name or email), then joined communities, then everyone else.
 * Picking one inserts "@username " or "@slug ".
 */
export const MentionTextarea = forwardRef<MentionTextareaHandle, MentionTextareaProps>(function MentionTextarea(
  { value, onChange, maxLength, placeholder, rows = 2, autoFocus, className, listClassName },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<ActiveMention | null>(null);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  /** Re-reads the "@token" under the caret. */
  function syncMention(text: string, caret: number | null) {
    if (caret == null) return setMention(null);
    const m = MENTION_TOKEN.exec(text.slice(0, caret));
    if (!m) return setMention(null);
    const query = m[1] ?? "";
    setMention({ start: caret - query.length - 1, query });
  }

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    startMention: () => {
      const el = textareaRef.current;
      if (!el) return;
      const caret = el.selectionStart ?? value.length;
      const before = value.slice(0, caret);
      const insert = before && !/\s$/.test(before) ? " @" : "@";
      const next = (before + insert + value.slice(caret)).slice(0, maxLength);
      onChange(next);
      const pos = Math.min(caret + insert.length, next.length);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
        syncMention(next, pos);
      });
    },
  }));

  // Fetch suggestions for the current query (debounced, cancellable, cached)
  const query = mention?.query.toLowerCase() ?? null;
  useEffect(() => {
    if (query == null) {
      setSuggestions([]);
      return;
    }
    setHighlight(0);
    const cached = cache.get(query);
    if (cached) {
      setSuggestions(cached);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mentions?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const list: MentionSuggestion[] = res.ok ? (await res.json()).suggestions : [];
        cache.set(query, list);
        setSuggestions(list);
      } catch {
        /* aborted by newer keystroke */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, FETCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function pick(s: MentionSuggestion) {
    if (!mention) return;
    const caret = mention.start + 1 + mention.query.length;
    const insert = `@${mentionHandle(s)} `;
    const next = (value.slice(0, mention.start) + insert + value.slice(caret).replace(/^\s/, "")).slice(0, maxLength);
    onChange(next);
    setMention(null);
    const pos = Math.min(mention.start + insert.length, next.length);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  const open = mention != null && (suggestions.length > 0 || loading);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape" && mention) setMention(null);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const s = suggestions[highlight];
      if (s) pick(s);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
    }
  }

  // Where each section header goes
  const headerAt = new Map<number, string>();
  {
    const firstUser = suggestions.findIndex((s) => s.kind === "user");
    const firstOtherUser = suggestions.findIndex((s) => s.kind === "user" && !s.relation);
    const firstJoined = suggestions.findIndex((s) => s.kind === "community" && s.isMember);
    const firstOtherCommunity = suggestions.findIndex((s) => s.kind === "community" && !s.isMember);
    if (firstUser !== -1) headerAt.set(firstUser, firstUser === firstOtherUser ? "People" : "People you know");
    if (firstOtherUser !== -1 && firstOtherUser !== firstUser) headerAt.set(firstOtherUser, "More people");
    if (firstJoined !== -1) headerAt.set(firstJoined, "Your communities");
    if (firstOtherCommunity !== -1)
      headerAt.set(firstOtherCommunity, firstJoined === -1 ? "Communities" : "More communities");
  }

  return (
    <div className="min-w-0 flex-1">
      <textarea
        ref={textareaRef}
        data-vaul-no-drag
        value={value}
        autoFocus={autoFocus}
        rows={rows}
        {...ENTER_ADDS_LINE} // Return adds a line; posting is the Post button's job
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value.slice(0, maxLength);
          onChange(next);
          syncMention(next, e.target.selectionStart);
        }}
        onSelect={(e) => syncMention(e.currentTarget.value, e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMention(null), 150)} // let a tap on a suggestion land first
        className={cn(
          "w-full resize-none bg-transparent text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100",
          className,
        )}
      />

      {open && (
        <div
          data-vaul-no-drag
          role="listbox"
          aria-label="Mention someone or a community"
          className={cn(
            "mt-1 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/95 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200",
            listClassName,
          )}
        >
          {loading && suggestions.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 text-[13px] text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Finding people and communities…
            </div>
          ) : (
            <ul className="max-h-[248px] overflow-y-auto overscroll-contain py-1">
              {suggestions.map((s, i) => (
                <li key={`${s.kind}-${s.id}`}>
                  {headerAt.has(i) && (
                    <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      {headerAt.get(i)}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    // mousedown, not click, so the textarea keeps focus (and the keyboard stays up)
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(s);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                      i === highlight ? "bg-white/[0.08]" : "hover:bg-white/[0.05]",
                    )}
                  >
                    {s.kind === "user" ? <UserRow s={s} /> : (
                      <>
                        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-800 ring-1 ring-white/10">
                          {s.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.coverImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[14px] font-bold text-white/80">{s.name.charAt(0).toUpperCase()}</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-white">{s.name}</span>
                          <span className="block truncate text-[12px] text-neutral-400">
                            @{s.slug} · {s.memberCount} {s.memberCount === 1 ? "member" : "members"}
                          </span>
                        </span>
                        {s.isMember ? (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-neutral-400">
                            <Check className="h-3 w-3" /> Joined
                          </span>
                        ) : (
                          <Users className="h-4 w-4 shrink-0 text-neutral-500" />
                        )}
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});

const RELATION_LABEL: Record<NonNullable<MentionUser["relation"]>, string> = {
  mutual: "Friends",
  following: "Following",
  follower: "Follows you",
};

function UserRow({ s }: { s: MentionUser }) {
  return (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-800 ring-1 ring-white/10">
        {s.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[14px] font-bold text-white/80">{s.name.charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-white">{s.name}</span>
        <span className="block truncate text-[12px] text-neutral-400">@{s.username}</span>
      </span>
      {s.relation && <span className="shrink-0 text-[11px] font-medium text-neutral-400">{RELATION_LABEL[s.relation]}</span>}
    </>
  );
}
