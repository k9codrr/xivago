import { notFound, redirect } from "next/navigation";
import { getSubCategoryById } from "@/lib/categories";
import { NicheDemands } from "@/components/featured/niche-demands";
import { FlowCard, FlowPage, industryHref } from "@/components/category-flow/flow-page";
import { IndustryBadges } from "@/components/category-flow/chips";

/** Sub category level: industries, provider types, then open demands in this sub category. */
export default async function SubCategoryPage({ params }: { params: Promise<{ id: string; sub: string }> }) {
  const { id, sub: subId } = await params;
  const found = getSubCategoryById(decodeURIComponent(subId));
  if (!found) notFound();
  const { parent, sub } = found;
  if (parent.id !== id) redirect(`/niche/${parent.id}/${sub.id}`);

  return (
    <FlowPage
      backHref={`/niche/${parent.id}`}
      crumbs={[{ label: parent.name, href: `/niche/${parent.id}` }]}
      title={sub.name}
      subtitle={sub.subtitle}
    >
      <section className="relative mt-4 px-4">
        <IndustryBadges industries={sub.industries} tone="dark" hrefFor={industryHref} />
      </section>

      <section className="relative mt-6 px-4">
        <h2 className="mb-3 text-[22px] font-bold tracking-[-0.02em]">Provider types</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {sub.providers.map((provider) => (
            <FlowCard key={provider.id} href={`/niche/${parent.id}/${sub.id}/${provider.id}`}>
              <p className="text-[15px] font-semibold">{provider.name}</p>
              <ul className="mt-2 space-y-1 text-[13px] text-[#EBEBF5]/60">
                {provider.problems.map((problem) => (
                  <li key={problem.id} className="line-clamp-1">
                    · {problem.title}
                  </li>
                ))}
              </ul>
            </FlowCard>
          ))}
        </div>
      </section>

      <section className="relative mt-8 px-4">
        <NicheDemands
          nicheId={parent.id}
          fixed={{ sub: sub.id }}
          filter={{ param: "provider", options: sub.providers.map((p) => ({ id: p.id, name: p.name })) }}
          excludeIds={[]}
        />
      </section>
    </FlowPage>
  );
}
