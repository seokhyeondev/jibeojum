import type { Metadata } from "next";
import { UserLanding } from "@/components/landing/user-landing";

export const metadata: Metadata = {
  title: "집어줌 | 출근지만 알려주면 중개사가 집을 찾아와요",
  description: "출근지·예산·안심 조건에 맞는 전월세 매물을 동네 공인중개사가 직접 확인해서 보내드려요.",
};

export default function HomePage() {
  return <UserLanding />;
}
