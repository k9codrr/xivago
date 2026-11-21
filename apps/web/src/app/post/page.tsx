"use client";

import { useRouter } from "next/navigation";
import { PostDemandModal } from "@/components/post-demand-modal";

export default function PostPage() {
  const router = useRouter();
  return <PostDemandModal open onClose={() => router.back()} />;
}