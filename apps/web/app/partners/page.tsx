import type { Metadata } from "next";
import { PartnerLanding } from "@/components/landing/partner-landing";

export const metadata: Metadata = {
  title: "집어줌 공인중개사 | 광고비 없이 이사가 정해진 고객에게 제안",
  description: "출근지·예산·입주일이 확정된 고객 요청을 보고 조건에 맞는 매물만 제안하세요. 가입과 요청 확인은 무료예요.",
};

export default function PartnersPage() {
  return <PartnerLanding />;
}
