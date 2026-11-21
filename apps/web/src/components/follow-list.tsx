"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { FollowButton } from "@/components/follow-button";

interface FollowUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
  role: string;
  isFollowedByViewer: boolean;
}

export function FollowList({ userId, kind }: { userId: string; kind: "followers" | "following" }) {
  const [users, setUsers] = useState<FollowUser[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/users/${userId}/${kind}`);
      setUsers(res.ok ? (await res.json()).users : []);
    })();
  }, [userId, kind]);

  if (users === null) {
    return (
      <div className="flex justify-center py-10 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="card-shell p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {kind === "followers" ? "No followers yet." : "Not following anyone yet."}
      </p>
    );
  }

  return (
    <div className="card-shell divide-y divide-neutral-100 dark:divide-neutral-800">
      {users.map((u) => (
        <div key={u.id} className="flex items-center justify-between gap-3 p-3.5">
          <Link href={`/u/${u.id}`} className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u.avatarUrl ?? "/icons/avatar-placeholder.svg"}
              alt={u.name}
              className="h-11 w-11 shrink-0 rounded-full bg-neutral-100 object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold dark:text-neutral-100">{u.companyName ?? u.name}</p>
              <p className="truncate text-xs text-neutral-400">{u.name}</p>
            </div>
          </Link>
          <FollowButton userId={u.id} initialFollowing={u.isFollowedByViewer} />
        </div>
      ))}
    </div>
  );
}
