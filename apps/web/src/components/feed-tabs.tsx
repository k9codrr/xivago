import { getOptionalUser } from "@/lib/guards";
import { AppHeader } from "@/components/app-header";
import { FeedInteractiveSection } from "@/components/feed-interactive-section";
import { ListFilterIcon } from "@animateicons/react/lucide";
import { HeroSlider, type HeroSlideData } from "@/components/featured/hero-slider";
import { getHeroSlides } from "@/lib/featured";
import { maskDemandAuthor } from "@/lib/demand-privacy";
import { ScrollToTop } from "@/components/scroll-to-top";

import { HOME_CATEGORIES } from "@/lib/home-categories";

export default async function FeedTabs() {
  const user = await getOptionalUser();
  if (!user) return null;

  // Dates → strings for the client component.
  const slides = (await getHeroSlides()).slides.map((s) =>
    s.demand ? { ...s, demand: maskDemandAuthor(s.demand, user) } : s,
  );
  const heroSlides: HeroSlideData[] = JSON.parse(JSON.stringify(slides));

  const hourIST = Number(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }),
  );
  const firstName = (user.name ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = hourIST < 12 ? "Good morning" : hourIST < 17 ? "Good afternoon" : "Good evening";
  const today = firstName ? `${greeting}, ${firstName}` : greeting;

  return (
    <main
      className="relative flex h-full min-h-dvh max-h-full flex-col bg-black pt-0 text-white antialiased selection:bg-[#0A84FF]/40"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif' }}
    >
      <ScrollToTop path="/" />
      {/* Ambient backdrop glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -left-24 -top-32 h-[380px] w-[380px] rounded-full bg-[#0A84FF]/25 blur-[120px]" />
        <div className="absolute -right-24 top-10 h-[320px] w-[320px] rounded-full bg-[#BF5AF2]/20 blur-[120px]" />
      </div>

      {/* ── Navigation bar ── */}
      <header className="relative z-50 w-full px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <AppHeader
          user={{
            name: user.name ?? "",
            handle: (user as { handle?: string }).handle ?? (user.name ? user.name.toLowerCase().replace(/\s+/g, "") : "user"),
            avatarUrl: user.image ?? "/icons/avatar-placeholder.svg",
            followingCount: (user as { followingCount?: number }).followingCount ?? 0,
            followerCount: (user as { followerCount?: number }).followerCount ?? 0,
            isPro: user.isPro ?? false,
          }}
        />

        {/* Large title */}
        <div className="mt-6 px-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#EBEBF5]/55">{today}</p>
          <h1 className="mt-0.5 text-[34px] font-bold leading-[1.1] tracking-[-0.025em]">
            What do you need?
          </h1>
        </div>
      </header>

      <section className="relative mt-4 flex-1 px-4 pb-8">
        {/* ── Featured hero: sponsored winners per niche, or top listings when bidding is off ── */}
        <HeroSlider slides={heroSlides} />
      </section>

      {/* Interactive Categories, Local 25km Filter, & Demands Tabs */}
      <FeedInteractiveSection categoryCards={HOME_CATEGORIES} />
    </main>
  );
}
