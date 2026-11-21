"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

export function MessageButton({ userId }: { userId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!session?.user) {
      router.push(`/login?callbackUrl=/u/${userId}`);
      return;
    }
    void haptic("light");
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/conversation`);
      const data = await res.json();
      if (!res.ok) {
        void haptic("warning");
        toast.info(data?.error?.message ?? "You'll be able to chat once you're connected through a request.");
        return;
      }
      router.push(`/chats/${data.conversation.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
  onClick={handleClick}
  disabled={loading}
  className="h-11 rounded-full bg-pearl px-6 text-sm font-semibold text-slate-navy hover:bg-neutral-200"
>
  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
  Message
</Button>
  );
}
