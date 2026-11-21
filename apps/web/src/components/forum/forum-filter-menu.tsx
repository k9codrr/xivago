"use client";

import { DropdownMenu } from "radix-ui";
import { Check, ChevronDown, ListFilter, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ForumSort = "new" | "hot";

const ITEM =
  "flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2.5 text-sm text-neutral-100 outline-none data-[highlighted]:bg-white/10";

/**
 * New and Hot are two orderings of one feed, so picking one replaces the other.
 * Near me narrows either of them and is ticked independently.
 */
export function ForumFilterMenu({
  sort,
  nearMe,
  locating,
  onSortChange,
  onNearMeToggle,
}: {
  sort: ForumSort;
  nearMe: boolean;
  locating: boolean;
  onSortChange: (sort: ForumSort) => void;
  onNearMeToggle: () => void;
}) {
  const label = [sort === "new" ? "New" : "Hot", ...(nearMe ? ["Near me"] : [])].join(" · ");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Filter posts: ${label}`}
        className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 outline-none data-[state=open]:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:data-[state=open]:bg-neutral-800"
      >
        <ListFilter className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[60] min-w-44 rounded-xl border border-white/10 bg-neutral-900 p-1 shadow-xl"
        >
          {(["new", "hot"] as const).map((option) => (
            <DropdownMenu.CheckboxItem
              key={option}
              checked={sort === option}
              // Stays open so several options can be set in one go.
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onSortChange(option)}
              className={ITEM}
            >
              {option === "new" ? "New" : "Hot"}
              <DropdownMenu.ItemIndicator>
                <Check className="h-4 w-4" />
              </DropdownMenu.ItemIndicator>
            </DropdownMenu.CheckboxItem>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
          <DropdownMenu.CheckboxItem
            checked={nearMe}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={onNearMeToggle}
            className={cn(ITEM, locating && "opacity-70")}
          >
            Near me
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DropdownMenu.ItemIndicator>
                <Check className="h-4 w-4" />
              </DropdownMenu.ItemIndicator>
            )}
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
