"use client";

import { Bell, Clock3, Home, MessageCircle, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useSubmittedRequest } from "@/lib/store/app-store";
import { useTrackNavigation } from "./back-navigation";

/** 하단 탭을 숨기는 화면: 입력 흐름, 상세, 비교, 상담 */
function hidesBottomNav(pathname: string): boolean {
  return (
    pathname === "/request" ||
    /^\/listings\/[^/]+$/.test(pathname) ||
    pathname === "/compare" ||
    pathname === "/messages"
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useTrackNavigation();
  return (
    <div className="app">
      <header className="top">
        <Link className="brand" href="/request?step=1">
          <i>
            <Home size={18} />
          </i>
          집이온다
        </Link>
        <div>
          <button type="button" aria-label="알림">
            <Bell size={22} />
            <em />
          </button>
          <button type="button" aria-label="내 정보">
            <UserRound size={22} />
          </button>
        </div>
      </header>
      <main>{children}</main>
      {!hidesBottomNav(pathname) && <BottomNav pathname={pathname} />}
      <Toaster position="top-center" theme="light" />
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  const [request] = useSubmittedRequest();
  const items = [
    { href: request ? "/request/complete" : "/request", match: "/request/complete", label: "홈", icon: <Home /> },
    { href: "/listings", match: "/listings", label: "매물", icon: <Search /> },
    { href: "/requests", match: "/requests", label: "내 요청", icon: <Clock3 /> },
    { href: "/messages", match: "/messages", label: "상담", icon: <MessageCircle /> },
  ];
  return (
    <nav aria-label="주요 메뉴">
      {items.map((item) => {
        const on = pathname === item.match;
        return (
          <Link key={item.label} href={item.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {item.icon}
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
