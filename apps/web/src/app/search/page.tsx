"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search as SearchIcon } from "lucide-react";
import { SearchResults } from "@/components/search-results";

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <main className="min-h-dvh bg-neutral-950 pb-16 dark:bg-black">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-neutral-950/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur dark:bg-black/95">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="text-neutral-300">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, requests, communities…"
            className="h-10 w-full rounded-full bg-neutral-900 pl-9 pr-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none"
          />
        </div>
      </header>

      <SearchResults q={q} />
    </main>
  );
}
