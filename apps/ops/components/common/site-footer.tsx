import type { ReactNode } from "react";
import { COMPANY, COMPANY_NAME, SITE, WEB_URL } from "@/lib/site";

/** 약관·개인정보처리방침·사업자 정보. 랜딩과 마이페이지 아래에 둔다 */
export function SiteFooter({ children }: { children?: ReactNode }) {
  const company = COMPANY.filter((item) => item.value);
  return (
    <footer className="site-footer">
      {children}
      <nav aria-label="약관">
        <a href={`${WEB_URL}/terms`}>이용약관</a>
        <a href={`${WEB_URL}/privacy`}>
          <b>개인정보처리방침</b>
        </a>
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
      <small>© {COMPANY_NAME}</small>
    </footer>
  );
}
