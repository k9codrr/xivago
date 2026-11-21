import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { PostModalProvider } from "@/components/post-modal-provider";
import { ConsentGate } from "@/components/consent-gate";
import { SwipeNavigator } from "@/components/swipe-navigator";
import { GlobalHaptics } from "@/components/global-haptics";
import { NativeKeyboard } from "@/components/native-keyboard";
import { LogoPullToRefresh } from "@/components/logo-pull-to-refresh";
import { TabShell } from "@/components/tab-shell";
import FeedTabs from "@/components/feed-tabs";
import ChatsListPage from "@/app/chats/page";
import ForumPage from "@/app/forum/page";
import ExplorePage from "@/app/explore/page";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: "xivago · Find the right person",
    template: "%s · xivago",
  },
  description:
    "Post what you need. Providers respond, and you choose who to talk to.",
  applicationName: "xivago",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    // Lets the page draw behind the iOS status bar, so there's no black strip on top.
    statusBarStyle: "black-translucent",
    title: "xivago",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Edge-to-edge: env(safe-area-inset-*) is only non-zero with this set. Page
  // headers use it to clear the notch; in a normal Chrome tab it resolves to 0.
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="min-h-dvh dark">
        <ThemeProvider>
          <Providers>
            <PostModalProvider>
              <ServiceWorkerRegistration />
              <ConsentGate />
              <GlobalHaptics />
              <NativeKeyboard />
              {/* Bottom nav is fixed at 64px + safe-area; pb-24 keeps content
                from being hidden under it on every page that renders it. */}
              <SwipeNavigator>
                <LogoPullToRefresh>
                  <div className="mx-auto min-h-dvh max-w-md">
                    {/* Keep-alive tabs: switching tabs never reloads the page.
                       Feed is a server component, so it's rendered here and
                       passed in; the rest are the tab pages themselves. */}
                    <TabShell
                      tabs={{
                        "/": <FeedTabs />,
                        "/chats": <ChatsListPage />,
                        "/forum": <ForumPage />,
                        "/explore": <ExplorePage />,
                      }}
                    >
                      {children}
                    </TabShell>
                  </div>
                </LogoPullToRefresh>
                <BottomNav />
              </SwipeNavigator>
            </PostModalProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
