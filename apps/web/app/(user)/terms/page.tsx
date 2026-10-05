import type { Metadata } from "next";
import { TermsOfService } from "@/components/legal/legal-pages";
import { SimpleHead } from "@/components/navigation/simple-head";

export const metadata: Metadata = { title: "이용약관 | 집어줌" };

export default function TermsPage() {
  return (
    <section>
      <SimpleHead title="이용약관" fallbackHref="/mypage" />
      <TermsOfService />
    </section>
  );
}
