import type { Metadata } from "next";
import { Hydrated } from "@/components/common/hydrated";
import { AreaDebug } from "@/components/debug/area-debug";

export const metadata: Metadata = {
  title: "추천 동네 디버그 | 집어줌",
  robots: { index: false, follow: false },
};

export default function AreaDebugPage() {
  return (
    <Hydrated>
      <AreaDebug />
    </Hydrated>
  );
}
