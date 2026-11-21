import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getParentCategoryById } from "@/lib/categories";
import { categoryHref } from "@/lib/category-selection";
import { getFeaturedSettings, getLiveSponsored, isFeaturedEnabled } from "@/lib/featured";
import { getOptionalUser } from "@/lib/guards";
import { maskDemandAuthor } from "@/lib/demand-privacy";
import { NicheDemands } from "@/components/featured/niche-demands";
import { SponsoredList, type SponsoredItem } from "@/components/featured/sponsored-list";
import { FlowCard } from "@/components/category-flow/flow-page";
import { IndustryBadges } from "@/components/category-flow/chips";

/**
 * Niche explore page (the hero's "Explore" target): sponsored placements
 * with rank badges when featured bidding is on, the niche's sub categories
 * (Main Category -> Sub Category -> Provider -> Problem flow continues at
 * /niche/[id]/[sub]), then every open demand in the niche, closest first.
 */
export default async function NichePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sub?: string }>;
}) {
  const { id } = await params;
  const { sub } = await searchParams;
  const category = getParentCategoryById(id);
  if (!category) {
    // A sub / provider / problem id used in place of the niche id: send it to its canonical page.
    const canonical = categoryHref(id);
    if (canonical) redirect(canonical);
    notFound();
  }
  // Legacy `?sub=` deep links -> /niche/[id]/[sub]
  if (sub && category.subCategories.some((s) => s.id === sub)) redirect(`/niche/${id}/${sub}`);

  const enabled = isFeaturedEnabled(await getFeaturedSettings());
  const viewer = await getOptionalUser();
  const sponsored: SponsoredItem[] = enabled
    ? JSON.parse(
        JSON.stringify(
          ((await getLiveSponsored(id)).get(id) ?? []).map((s) => ({ ...s, demand: maskDemandAuthor(s.demand, viewer) })),
        ),
      )
    : [];

  return (
    <main
      className="relative min-h-dvh bg-black pb-24 text-white antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden">
        <div className="absolute -left-24 -top-32 h-[320px] w-[320px] rounded-full bg-[#0A84FF]/20 blur-[120px]" />
      </div>

      <header className="relative px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Link
          href="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08] backdrop-blur-2xl"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="mt-5 text-[34px] font-bold leading-[1.1] tracking-[-0.025em]">{category.name}</h1>
        <p className="mt-1 text-[15px] text-[#EBEBF5]/60">
          {category.subCategories.length} sub categories ·{" "}
          <Link href={`/categories?category=${category.id}`} className="text-[#0A84FF]">
            Search services
          </Link>
        </p>
      </header>

      {sponsored.length > 0 && (
        <section className="relative mt-6 px-4">
          <SponsoredList items={sponsored} />
        </section>
      )}

      <section className="relative mt-6 px-4">
        <h2 className="mb-3 text-[22px] font-bold tracking-[-0.02em]">Sub categories</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {category.subCategories.map((sub) => (
            <FlowCard key={sub.id} href={`/niche/${category.id}/${sub.id}`}>
              <p className="text-[15px] font-semibold">{sub.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] text-[#EBEBF5]/60">{sub.subtitle}</p>
              <p className="mt-2 text-[12px] text-[#EBEBF5]/50">
                {sub.providers.length} provider types · {sub.providers.reduce((n, p) => n + p.problems.length, 0)} problems
              </p>
              <IndustryBadges industries={sub.industries} tone="dark" className="mt-2" />
            </FlowCard>
          ))}
        </div>
      </section>

      <section className="relative mt-8 px-4">
        <NicheDemands
          nicheId={id}
          filter={{ param: "sub", options: category.subCategories.map((s) => ({ id: s.id, name: s.name })) }}
          excludeIds={sponsored.map((s) => s.demand.id)}
        />
      </section>
    </main>
  );
}
