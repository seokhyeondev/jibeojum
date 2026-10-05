"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, ClipboardList, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/common/hydrated";
import { logout } from "@/lib/api/client";
import { useSubmittedRequest } from "@/lib/store/app-store";
import { SiteFooter } from "@/components/common/site-footer";
import { WithdrawButton } from "./withdraw";
import { LoginPrompt, useMe } from "./kakao-login";

export function MyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, setRequest] = useSubmittedRequest();
  const { data: me, isPending } = useMe();

  if (isPending) return <LoadingBlock />;
  if (!me?.user) {
    return (
      <section className="mypage">
        <LoginPrompt title="로그인이 필요해요" description="카카오로 로그인하면 내 요청과 도착한 매물을 언제든 확인할 수 있어요." returnTo="/mypage" />
        <SiteFooter />
      </section>
    );
  }

  const { nickname, profileImageUrl } = me.user;
  return (
    <section className="mypage">
      <div className="profile">
        <span className="avatar">
          {/* eslint-disable-next-line @next/next/no-img-element -- 카카오 프로필 사진 (외부 주소) */}
          {profileImageUrl ? <img src={profileImageUrl} alt="" /> : <UserRound aria-hidden />}
        </span>
        <span>
          <b>{nickname ?? "집어줌 회원"}님</b>
          <small>{me.user.provider === "apple" ? "Apple" : "카카오"} 계정으로 로그인했어요</small>
        </span>
      </div>
      <ul className="menu">
        <li>
          <Link href="/requests">
            <ClipboardList aria-hidden /> 내 매물 요청 <ChevronRight aria-hidden />
          </Link>
        </li>
        <li>
          <Link href="/notifications">
            <Bell aria-hidden /> 알림 <ChevronRight aria-hidden />
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={async () => {
              await logout().catch(() => undefined);
              // 이 브라우저에 남은 요청 사본도 지운다 (다른 사람이 볼 수 있으니)
              setRequest(null);
              queryClient.clear();
              router.replace("/request?step=1");
            }}
          >
            <LogOut aria-hidden /> 로그아웃
          </button>
        </li>
      </ul>
      <WithdrawButton />
      <SiteFooter />
    </section>
  );
}
