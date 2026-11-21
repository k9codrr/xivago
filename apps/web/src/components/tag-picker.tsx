"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { customTagError, normalizeTagInput } from "@/lib/custom-tags";

export const MAX_TAGS = 5;

interface TagPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Ranks this sub category's tags first. */
  subId?: string | null;
  placeholder?: string;
  className?: string;
  /** Lets people add a tag that isn't in the list (typed in the search box). */
  allowCustom?: boolean;
}

/**
 * Searchable tag dropdown, limited to MAX_TAGS picks. Options come from
 * /api/tags because the full list is too large to ship to the browser. The
 * list renders in normal flow, so it works inside drawers and popovers that
 * clip overflow or close on outside tap.
 */
export function TagPicker({
  value,
  onChange,
  subId,
  placeholder = "Search tags…",
  className,
  allowCustom = false,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const atLimit = value.length >= MAX_TAGS;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL("/api/tags", window.location.origin);
        if (query.trim()) url.searchParams.set("q", query.trim());
        if (subId) url.searchParams.set("sub", subId);
        if (allowCustom) url.searchParams.set("custom", "1");
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setOptions(data.tags);
          setCustomOptions(data.custom ?? []);
        }
        setLoading(false);
      } catch {
        // Superseded by a newer keystroke; that request owns the loading state.
      }
    }, 200);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [open, query, subId, allowCustom]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
    } else if (!atLimit) {
      onChange([...value, tag]);
    }
  }

  const typed = normalizeTagInput(query);
  const typedIsListed = options.includes(typed) || value.includes(typed);
  const typedError = typed ? customTagError(typed) : null;
  const canAddTyped = allowCustom && Boolean(typed) && !typedIsListed && !typedError && !atLimit;

  function addTyped() {
    if (!canAddTyped) return;
    onChange([...value, typed]);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-white"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggle(tag)}
                aria-label={`Remove ${tag}`}
                className="rounded-full p-0.5 hover:bg-white/15"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-neutral-400"
      >
        <span>{atLimit ? "Maximum tags selected" : "Add tags"}</span>
        <span className="flex items-center gap-2 text-xs">
          {value.length}/{MAX_TAGS}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]">
          <div className="relative border-b border-white/10">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canAddTyped) addTyped();
                  else if (options[0] && !atLimit && !value.includes(options[0])) toggle(options[0]);
                }
              }}
              placeholder={allowCustom ? `${placeholder.replace(/…$/, "")} or add your own…` : placeholder}
              aria-label="Search tags"
              className="h-10 w-full bg-transparent pl-9 pr-9 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-500" />}
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-52 overflow-y-auto py-1">
            {allowCustom && typed && !typedIsListed && (
              <li>
                <button
                  type="button"
                  onClick={addTyped}
                  disabled={!canAddTyped}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    Add &ldquo;{typed}&rdquo;
                  </span>
                  {typedError ? (
                    <span className="shrink-0 text-[11px] text-red-400">{typedError}</span>
                  ) : atLimit ? (
                    <span className="shrink-0 text-[11px] text-neutral-500">Max {MAX_TAGS} tags</span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-neutral-500">Custom tag</span>
                  )}
                </button>
              </li>
            )}
            {options.map((tag) => {
              const selected = value.includes(tag);
              return (
                <li key={tag} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => toggle(tag)}
                    disabled={!selected && atLimit}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-40"
                  >
                    <span className="min-w-0 truncate">{tag}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {customOptions.includes(tag) && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400">community</span>
                      )}
                      {selected && <Check className="h-4 w-4 shrink-0 text-white" />}
                    </span>
                  </button>
                </li>
              );
            })}
            {!loading && options.length === 0 && !(allowCustom && typed) && (
              <li className="px-3 py-4 text-center text-xs text-neutral-500">
                {allowCustom ? "No matching tags. Type to add your own." : "No matching tags."}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
