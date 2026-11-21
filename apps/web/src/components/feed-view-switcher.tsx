"use client";

import { useState } from "react";
import { Flame, List } from "lucide-react";
import { FeedList } from "@/components/feed-list";
import { DiscoverDeck } from "@/components/discover-deck";
import { cn } from "@/lib/utils";

type View = "discover" | "feed";

const VIEWS: Array<{ key: View; label: string; icon: typeof List }> = [
  { key: "discover", label: "Discover", icon: Flame },
  { key: "feed", label: "Feed", icon: List },
];

export function FeedViewSwitcher() {
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "feed";
    return (localStorage.getItem("feed-view") as View) || "feed";
  });

  const select = (v: View) => {
    setView(v);
    localStorage.setItem("feed-view", v);
  };

  return (
    <div>
      <div className="mb-4 flex justify-center">
        <div className="flex rounded-full border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-800">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => select(key)}
              aria-pressed={view === key}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                view === key
                  ? "bg-white text-neutral-900 shadow dark:bg-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {view === "feed" ? <FeedList /> : <DiscoverDeck />}
    </div>
  );
}