"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MoreHorizontal, QrCode } from "lucide-react";
import { toast } from "sonner";
import { ProfileQrModal } from "@/components/profile-qr-modal";
import { Haptic } from "@/components/ui/haptic";
import { haptic } from "@/lib/haptics";

export function ProfileBackButton() {
  const router = useRouter();
  return (
    <Haptic type="light">
      <button
        onClick={() => router.back()}
        aria-label="Back"
        className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition active:scale-95"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
    </Haptic>
  );
}

export function ProfileShareButton() {
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        void haptic("success");
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  }
  return (
    <Haptic type="light">
    <button
      onClick={share}
      aria-label="Share"
      className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition active:scale-95"
    >
      <MoreHorizontal className="h-5 w-5" />
    </button>
    </Haptic>
  );
}

export function ProfileQrButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Haptic type="medium">
      <button
        onClick={() => setOpen(true)}
        aria-label="My QR code"
        className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition active:scale-95"
      >
        <QrCode className="h-5 w-5" />
      </button>
      </Haptic>
      <ProfileQrModal open={open} onClose={() => setOpen(false)} userId={userId} name={name} />
    </>
  );
}