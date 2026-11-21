"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface SuggestedUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
  isVerified: boolean;
  reason: string;
}

/** Horizontal "Suggested for you" row, in the context of the profile being viewed. */
export function SuggestedUsers({ profileId }: { profileId: string }) {
  const [users, setUsers] = useState<SuggestedUser[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/users/${profileId}/suggestions`);
      const data = res.ok ? await res.json() : { users: [] };
      if (!cancelled) setUsers(data.users);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const visible = users?.filter((u) => !dismissed.has(u.id)) ?? [];
  if (users === null) return <SuggestionSkeleton />;
  if (visible.length === 0) return null;

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Suggested for you</h2>
      </div>
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((u) => (
          <SuggestionCard key={u.id} user={u} onDismiss={() => setDismissed((s) => new Set(s).add(u.id))} />
        ))}
      </div>
    </section>
  );
}

function SuggestionCard({ user, onDismiss }: { user: SuggestedUser; onDismiss: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleFollow() {
    if (!session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    void haptic("medium");
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch(`/api/users/${user.id}/follow`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) {
        setFollowing(!next);
        void haptic("error");
        toast.error("Could not update follow status.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex w-[148px] shrink-0 snap-start flex-col items-center rounded-3xl border border-white/10 bg-neutral-900/70 px-3 pb-3 pt-5 text-center">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Hide ${user.name}`}
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-neutral-500 hover:text-neutral-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <Link href={`/u/${user.id}`} className="flex w-full flex-col items-center">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" loading="lazy" className="h-16 w-16 rounded-full object-cover ring-1 ring-white/10" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-neutral-800 text-xl font-bold text-neutral-200">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="mt-2.5 flex w-full items-center justify-center gap-1">
          <span className="truncate text-sm font-semibold text-white">{user.name}</span>
          {user.isVerified && (
            <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-mint text-[8px] font-black text-white">✓</span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 min-h-[2rem] text-[11px] leading-4 text-neutral-500">{user.reason}</span>
      </Link>

      <button
        type="button"
        onClick={toggleFollow}
        disabled={busy}
        className={cn(
          "mt-3 h-8 w-full rounded-full text-xs font-semibold transition-colors disabled:opacity-60",
          following ? "border border-white/15 text-pearl" : "bg-pearl text-slate-navy",
        )}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}

function SuggestionSkeleton() {
  return (
    <div className="-mx-5 flex gap-3 overflow-hidden px-5" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex w-[148px] shrink-0 flex-col items-center rounded-3xl border border-white/5 bg-neutral-900/50 px-3 pb-3 pt-5">
          <span className="h-16 w-16 animate-pulse rounded-full bg-neutral-800" />
          <span className="mt-3 h-3 w-20 animate-pulse rounded bg-neutral-800" />
          <span className="mt-2 h-2.5 w-24 animate-pulse rounded bg-neutral-800" />
          <span className="mt-3 h-8 w-full animate-pulse rounded-full bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}
