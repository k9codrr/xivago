"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

interface CommunityJoinButtonProps {
  communityId: string;
  initialMember: boolean;
  isCreator?: boolean;
  onChange?: (member: boolean) => void;
}

export function CommunityJoinButton({ communityId, initialMember, isCreator, onChange }: CommunityJoinButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [member, setMember] = useState(initialMember);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!session?.user) {
      router.push(`/login?callbackUrl=/communities/${communityId}`);
      return;
    }
    setBusy(true);
    void haptic("medium");
    const next = !member;
    setMember(next);
    onChange?.(next);
    try {
      const res = await fetch(`/api/communities/${communityId}/join`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) {
        setMember(!next);
        onChange?.(!next);
        void haptic("error");
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message ?? "Could not update your membership.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (isCreator) {
    return (
      <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
        Your community
      </span>
    );
  }

  return (
    <Button size="sm" variant={member ? "outline" : "default"} onClick={toggle} disabled={busy} className="min-w-20">
      {member ? "Joined" : "Join"}
    </Button>
  );
}
