import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FollowList } from "@/components/follow-list";

export default async function FollowersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <header className="mb-4 flex items-center gap-3">
        <Link href={`/u/${id}`} aria-label="Back" className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ChevronLeft className="h-5 w-5 dark:text-neutral-200" />
        </Link>
        <h1 className="text-lg font-bold dark:text-neutral-100">Followers</h1>
      </header>
      <FollowList userId={id} kind="followers" />
    </main>
  );
}
