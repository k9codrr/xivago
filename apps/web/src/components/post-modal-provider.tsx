"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { PostDemandModal } from "@/components/post-demand-modal";

const PostModalContext = createContext<{ openPostModal: () => void }>({
  openPostModal: () => {},
});

export const usePostModal = () => useContext(PostModalContext);

export function PostModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openPostModal = useCallback(() => setOpen(true), []);
  const closePostModal = useCallback(() => setOpen(false), []);

  return (
    <PostModalContext.Provider value={{ openPostModal }}>
      {children}
      {/* Rendered once at the root → opens over ANY page */}
      <PostDemandModal open={open} onClose={closePostModal} />
    </PostModalContext.Provider>
  );
}