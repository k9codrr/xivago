"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "@slotbook/db";

const MAX_SERVICES = 15;

interface ServicesPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function ServicesPicker({ value, onChange }: ServicesPickerProps) {
  const [customTag, setCustomTag] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(
    Object.keys(SERVICE_CATEGORIES)[0] ?? "",
  );

  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
      return;
    }
    if (value.length >= MAX_SERVICES) return;
    onChange([...value, tag]);
  }

  function addCustomTag() {
    const tag = customTag.trim();
    if (!tag || value.includes(tag) || value.length >= MAX_SERVICES) return;
    onChange([...value, tag]);
    setCustomTag("");
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggle(tag)}
                aria-label={`Remove ${tag}`}
                className="rounded-full hover:bg-brand-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-1.5">
        {Object.keys(SERVICE_CATEGORIES).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              activeCategory === cat
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="card-shell mb-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto p-3">
        {(SERVICE_CATEGORIES[activeCategory] ?? []).map((tag) => {
          const selected = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              disabled={!selected && value.length >= MAX_SERVICES}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
                selected
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-300",
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomTag();
            }
          }}
          placeholder="Add your own tag…"
          maxLength={40}
          className="h-10 flex-1 rounded-xl border border-neutral-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        <button
          type="button"
          onClick={addCustomTag}
          disabled={!customTag.trim() || value.length >= MAX_SERVICES}
          className="h-10 rounded-xl bg-neutral-900 px-4 text-xs font-semibold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        {value.length}/{MAX_SERVICES} services selected
      </p>
    </div>
  );
}
