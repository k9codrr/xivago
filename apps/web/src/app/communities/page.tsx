"use client";

import { PageHeader } from "@/components/page-header";
import { CommunityList } from "@/components/community-list";

export default function CommunitiesPage() {
  return (
    <main className="min-h-dvh px-4 pb-10">
      <PageHeader title="Communities" className="mb-4" />
      <CommunityList />
    </main>
  );
}
