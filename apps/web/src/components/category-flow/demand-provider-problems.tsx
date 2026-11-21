import Link from "next/link";
import { cn } from "@/lib/utils";
import { categoryHref, describeDemandCategory } from "@/lib/category-selection";
import { TagChips } from "@/components/category-flow/chips";

/**
 * Provider type + problems picked on a demand. Renders nothing for older
 * demands that only stored a sub category.
 */
export function DemandProviderProblems({
  providerId,
  problemIds,
  className,
}: {
  providerId?: string | null;
  problemIds?: string[] | null;
  className?: string;
}) {
  const { provider, problems } = describeDemandCategory(providerId, problemIds);
  if (!provider) return null;
  const providerHref = categoryHref(provider.id);

  return (
    <div className={cn("space-y-1.5 text-xs", className)}>
      <p className="text-neutral-500">
        Provider wanted:{" "}
        {providerHref ? (
          <Link href={providerHref} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            {provider.name}
          </Link>
        ) : (
          <span className="font-semibold">{provider.name}</span>
        )}
      </p>
      {problems.length > 0 && (
        <ul className="space-y-1.5">
          {problems.map((problem) => (
            <li key={problem.id}>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{problem.title}</span>
              <TagChips tags={problem.tags} className="mt-1" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
