"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// 앱 안에서 이동한 적이 있으면 뒤로 버튼이 브라우저 히스토리를 따르고,
// 직접 URL로 들어온 경우에는 지정한 상위 화면으로 이동한다.
let inAppNavigations = 0;
let lastPathname: string | null = null;

export function useTrackNavigation() {
  const pathname = usePathname();
  useEffect(() => {
    if (lastPathname !== null && lastPathname !== pathname) inAppNavigations++;
    lastPathname = pathname;
  }, [pathname]);
}

export function useBack(fallbackHref: string) {
  const router = useRouter();
  return () => {
    if (inAppNavigations > 0) router.back();
    else router.push(fallbackHref);
  };
}
