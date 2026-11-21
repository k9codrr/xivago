"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { forgetPushTokenOnSignOut } from "@/lib/push-client";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      className="w-full justify-center text-red-600 hover:bg-red-50"
      onClick={async () => {
        // Unlink this device's push token first, while the session still exists.
        await forgetPushTokenOnSignOut();
        await signOut({ callbackUrl: "/login" });
      }}
    >
      <LogOut className="h-4 w-4" />
      Log out
    </Button>
  );
}
