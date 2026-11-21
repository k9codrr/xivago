import { CATEGORIES_DATA, getAllIndustries } from "@/lib/categories";
import { matchTaxonomy, subIdsForTags } from "@/lib/category-tags.server";
import { FlowPage } from "@/components/category-flow/flow-page";
import { CategoryExplorer } from "@/components/category-flow/category-explorer";

/**
 * Search the whole Main Category -> Sub Category -> Provider -> Problem flow,
 * filtered by main category, industry and tag. Filters live in the query
 * string (?q=&category=&industry=&tag=a,b) so results are linkable. The full
 * tag index is server-only, so tag and text matches are resolved here.
 */
export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; industry?: string; tag?: string }>;
}) {
  const { q, category, industry, tag } = await searchParams;
  const tags = (tag ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);

  return (
    <FlowPage backHref="/explore/categories" crumbs={[]} title="Find the right expert" subtitle="Search services, tags and categories.">
      <CategoryExplorer
        initial={{ q: q ?? "", category: category ?? "", industry: industry ?? "", tags }}
        serverMatches={{ querySubIds: q ? matchTaxonomy(q).subIds : [], tagSubIds: subIdsForTags(tags) }}
        categories={CATEGORIES_DATA.map((c) => ({ id: c.id, name: c.name }))}
        industries={getAllIndustries()}
      />
    </FlowPage>
  );
}
