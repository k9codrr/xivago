"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

interface FollowButtonProps {
  userId: string;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
}

export function FollowButton({ userId, initialFollowing, onChange }: FollowButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!session?.user) {
      router.push(`/login?callbackUrl=/u/${userId}`);
      return;
    }
    setBusy(true);
    void haptic("medium");
    const next = !following;
    setFollowing(next); // optimistic
    onChange?.(next);
    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) {
        setFollowing(!next);
        onChange?.(!next);
        void haptic("error");
        toast.error("Could not update follow status.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
     <Button
  variant="ghost"
  onClick={toggle}
  disabled={busy}
  className="h-11 rounded-full w-[50%] px-3 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
>
  {following ? "Following" : "Follow"}
</Button>
  );
}
