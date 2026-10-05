import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/legal/legal-pages";
import { SimpleHead } from "@/components/navigation/simple-head";

export const metadata: Metadata = { title: "개인정보처리방침 | 집어줌" };

export default function PrivacyPage() {
  return (
    <section>
      <SimpleHead title="개인정보처리방침" fallbackHref="/mypage" />
      <PrivacyPolicy />
    </section>
  );
}
