"use client";

import type { ReactNode } from "react";
import { useHydrated } from "@/lib/store/persistent-store";

export function LoadingBlock() {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="sr-only">불러오는 중</span>
      <i />
      <i />
      <i />
    </div>
  );
}

/** 로컬 저장값을 읽은 뒤에만 children을 그린다. 그 전에는 자리만 잡아 둔다. */
export function Hydrated({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  return hydrated ? children : <LoadingBlock />;
}
