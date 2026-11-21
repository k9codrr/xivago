"use client";

import { Users } from "lucide-react";
import { CommunityList } from "@/components/community-list";

export default function CommunitiesPage() {
  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <header className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-brand-600" />
        <h1 className="text-xl font-bold dark:text-neutral-100">Communities</h1>
      </header>
      <CommunityList />
    </main>
  );
}
