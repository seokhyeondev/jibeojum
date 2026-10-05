"use client";

import { Bell, Clock3, Home, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { LoginResultToast, LoginSheet, useMe } from "@/components/auth/kakao-login";
import { LogoMark } from "@/components/common/logo-mark";
import { NativeBridge } from "@/components/native/native-bridge";
import { RequestSync } from "@/components/providers/request-sync";
import { Toaster } from "@/components/ui/sonner";
import { fetchNotifications } from "@/lib/api/client";
import { useSubmittedRequest } from "@/lib/store/app-store";
import { useTrackNavigation } from "./back-navigation";

/** 하단 탭을 숨기는 화면: 입력 흐름, 상세, 비교, 상담 */
function hidesBottomNav(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/request" ||
    /^\/listings\/[^/]+$/.test(pathname) ||
    pathname === "/compare" ||
    pathname === "/messages" ||
    pathname === "/notifications" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname.startsWith("/debug")
  );
}

/** 사용자 화면 틀. 공인중개사 웹(apps/partner)·운영 웹(apps/admin)은 따로 배포한다 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <UserShell pathname={pathname}>{children}</UserShell>;
}

function UserShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  useTrackNavigation();
  return (
    <div className="app">
      <header className="top">
        <Link className="brand" href="/">
          <i>
            <LogoMark />
          </i>
          집어줌
        </Link>
        <HeaderActions />
      </header>
      <main>{children}</main>
      {!hidesBottomNav(pathname) && <BottomNav pathname={pathname} />}
      <Toaster position="top-center" theme="light" />
      <RequestSync />
      <NativeBridge />
      <Suspense fallback={null}>
        <LoginResultToast />
      </Suspense>
    </div>
  );
}

/** 알림·내 정보. 로그인 전이면 카카오 로그인 안내를 띄우고, 로그인하면 가려던 화면으로 돌아온다 */
function HeaderActions() {
  const { data: me } = useMe();
  const loggedIn = Boolean(me?.user);
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, refetchInterval: 60_000, enabled: loggedIn });
  const [sheet, setSheet] = useState<{ returnTo: string; title: string } | null>(null);
  const unread = loggedIn ? (data?.unreadCount ?? 0) : 0;
  const photo = me?.user?.profileImageUrl;

  if (!loggedIn) {
    return (
      <div>
        <button type="button" aria-label="알림" onClick={() => setSheet({ returnTo: "/notifications", title: "로그인하고 알림을 받아보세요" })}>
          <Bell size={22} />
        </button>
        <button type="button" aria-label="내 정보" onClick={() => setSheet({ returnTo: "/mypage", title: "로그인이 필요해요" })}>
          <UserRound size={22} />
        </button>
        <LoginSheet open={sheet !== null} onClose={() => setSheet(null)} returnTo={sheet?.returnTo ?? "/"} title={sheet?.title ?? ""} />
      </div>
    );
  }
  return (
    <div>
      <Link href="/notifications" aria-label={unread ? `알림 ${unread}개 안 읽음` : "알림"}>
        <Bell size={22} />
        {unread > 0 && <em />}
      </Link>
      <Link href="/mypage" aria-label="내 정보" className={photo ? "avatar" : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 카카오 프로필 사진 (외부 주소) */}
        {photo ? <img src={photo} alt="" /> : <UserRound size={22} />}
      </Link>
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  const [request] = useSubmittedRequest();
  const items = [
    { href: request ? "/request/complete" : "/request", match: "/request/complete", label: "홈", icon: <Home /> },
    // 매물은 요청에 딸린 화면이라 내 요청 → 요청 카드 → 매물 순서로 들어간다
    { href: "/requests", match: "/requests", also: "/listings", label: "내 요청", icon: <Clock3 /> },
    { href: "/messages", match: "/messages", label: "상담", icon: <MessageCircle /> },
  ];
  return (
    <nav aria-label="주요 메뉴">
      {items.map((item) => {
        const on = pathname === item.match || ("also" in item && pathname === item.also);
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
