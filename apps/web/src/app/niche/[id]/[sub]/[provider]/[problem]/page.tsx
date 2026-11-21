import { notFound, redirect } from "next/navigation";
import { getProblemById } from "@/lib/categories";
import { NicheDemands } from "@/components/featured/niche-demands";
import { FlowPage, industryHref, tagHref } from "@/components/category-flow/flow-page";
import { IndustryBadges, TagChips } from "@/components/category-flow/chips";

/** Problem level: tags, the sub category's industries, and demands posted for this problem. */
export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string; sub: string; provider: string; problem: string }>;
}) {
  const { id, sub: subId, provider: providerId, problem: problemId } = await params;
  const found = getProblemById(decodeURIComponent(problemId));
  if (!found) notFound();
  const { parent, sub, provider, problem } = found;
  if (parent.id !== id || sub.id !== decodeURIComponent(subId) || provider.id !== decodeURIComponent(providerId)) {
    redirect(`/niche/${parent.id}/${sub.id}/${provider.id}/${problem.id}`);
  }

  return (
    <FlowPage
      backHref={`/niche/${parent.id}/${sub.id}/${provider.id}`}
      crumbs={[
        { label: parent.name, href: `/niche/${parent.id}` },
        { label: sub.name, href: `/niche/${parent.id}/${sub.id}` },
        { label: provider.name, href: `/niche/${parent.id}/${sub.id}/${provider.id}` },
      ]}
      title={problem.title}
    >
      <section className="relative mt-4 space-y-3 px-4">
        <TagChips tags={problem.tags} tone="dark" hrefFor={tagHref} />
        <IndustryBadges industries={sub.industries} tone="dark" hrefFor={industryHref} />
      </section>

      <section className="relative mt-8 px-4">
        <NicheDemands nicheId={parent.id} fixed={{ problem: problem.id }} excludeIds={[]} />
      </section>
    </FlowPage>
  );
}
