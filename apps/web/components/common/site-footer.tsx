import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANY, SITE } from "@/lib/site";

/** 약관·개인정보처리방침·사업자 정보. 랜딩과 마이페이지 아래에 둔다 */
export function SiteFooter({ children }: { children?: ReactNode }) {
  const company = COMPANY.filter((item) => item.value);
  return (
    <footer className="site-footer">
      {children}
      <nav aria-label="약관">
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">
          <b>개인정보처리방침</b>
        </Link>
      </nav>
      <dl>
        {company.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        <div>
          <dt>문의</dt>
          <dd>
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </dd>
        </div>
      </dl>
      <small>© {SITE.name}</small>
    </footer>
  );
}
