"use client";

import { useState, type ReactNode } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { CelebrationHost } from "@/components/celebration";
import { usePresenceConnection } from "@/lib/presence";

/** Keeps the signed-in user "online" for their chat partners while the app is open. */
function PresenceConnector() {
  const { status } = useSession();
  usePresenceConnection(status === "authenticated");
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <PresenceConnector />
        <CelebrationHost />
        <Toaster position="top-center" richColors closeButton />
      </QueryClientProvider>
    </SessionProvider>
  );
}
