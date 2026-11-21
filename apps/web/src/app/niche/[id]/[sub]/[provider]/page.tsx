import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProviderById } from "@/lib/categories";
import { NicheDemands } from "@/components/featured/niche-demands";
import { FlowPage, tagHref } from "@/components/category-flow/flow-page";
import { TagChips } from "@/components/category-flow/chips";

/** Provider level: the problems this provider type solves (with tags), then matching demands. */
export default async function ProviderPage({
  params,
}: {
  params: Promise<{ id: string; sub: string; provider: string }>;
}) {
  const { id, sub: subId, provider: providerId } = await params;
  const found = getProviderById(decodeURIComponent(providerId));
  if (!found) notFound();
  const { parent, sub, provider } = found;
  if (parent.id !== id || sub.id !== decodeURIComponent(subId)) {
    redirect(`/niche/${parent.id}/${sub.id}/${provider.id}`);
  }
  const base = `/niche/${parent.id}/${sub.id}/${provider.id}`;

  return (
    <FlowPage
      backHref={`/niche/${parent.id}/${sub.id}`}
      crumbs={[
        { label: parent.name, href: `/niche/${parent.id}` },
        { label: sub.name, href: `/niche/${parent.id}/${sub.id}` },
      ]}
      title={provider.name}
      subtitle={`Helps with ${provider.problems.length} common needs`}
    >
      <section className="relative mt-6 px-4">
        <h2 className="mb-3 text-[22px] font-bold tracking-[-0.02em]">Common needs</h2>
        <div className="space-y-2.5">
          {provider.problems.map((problem) => (
            <div
              key={problem.id}
              id={`problem-${problem.id}`}
              className="scroll-mt-6 rounded-[20px] border border-white/[0.06] bg-[#1C1C1E] p-4"
            >
              <Link href={`${base}/${problem.id}`} className="text-[15px] font-semibold hover:text-[#0A84FF]">
                {problem.title}
              </Link>
              <TagChips tags={problem.tags} tone="dark" hrefFor={tagHref} className="mt-2" />
            </div>
          ))}
        </div>
      </section>

      <section className="relative mt-8 px-4">
        <NicheDemands
          nicheId={parent.id}
          fixed={{ provider: provider.id }}
          filter={{ param: "problem", options: provider.problems.map((p) => ({ id: p.id, name: p.title })) }}
          excludeIds={[]}
        />
      </section>
    </FlowPage>
  );
}
