"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { agentApi } from "@/lib/api/ops";

export type OpsKind = "agent";

const NAV: Record<OpsKind, { href: string; label: string }[]> = {
  agent: [
    { href: "/agent", label: "배정 요청" },
    { href: "/agent/chats", label: "문의" },
  ],
};

/** 공인중개사 메뉴의 안 읽은 문의 수 */
function ChatUnreadBadge() {
  const { data } = useQuery({ queryKey: ["agent", "chat-unread"], queryFn: agentApi.chatUnread, refetchInterval: 30_000, retry: false });
  return data ? <em className="ops-nav-badge" aria-label={`안 읽은 문의 ${data}개`}>{data}</em> : null;
}

const TITLE: Record<OpsKind, string> = { agent: "공인중개사" };

/** 공인중개사 웹 레이아웃 (데스크톱 폭) */
export function OpsShell({ kind, children, signedIn = true }: { kind: OpsKind; children: ReactNode; signedIn?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = async () => {
    await agentApi.logout().catch(() => undefined);
    queryClient.clear();
    router.replace(`/${kind}/login`);
  };

  return (
    <div className={`ops ops-${kind}`}>
      <header className="ops-top">
        <Link href={`/${kind}`} className="ops-brand">
          <i>
            <Building2 aria-hidden />
          </i>
          집어줌 <span>{TITLE[kind]}</span>
        </Link>
        {signedIn && (
          <nav aria-label={`${TITLE[kind]} 메뉴`}>
            {NAV[kind].map((item) => {
              const on = item.href === `/${kind}` ? pathname === item.href || pathname.startsWith(`/${kind}/requests`) || pathname.startsWith(`/${kind}/assignments`) : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
                  {item.label}
                  {item.href === "/agent/chats" && <ChatUnreadBadge />}
                </Link>
              );
            })}
          </nav>
        )}
        {signedIn && (
          <button type="button" className="ops-logout" onClick={() => void logout()}>
            <LogOut aria-hidden /> 로그아웃
          </button>
        )}
      </header>
      <main className="ops-main">{children}</main>
    </div>
  );
}
