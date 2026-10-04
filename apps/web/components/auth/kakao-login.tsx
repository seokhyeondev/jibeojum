"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { fetchMe, kakaoLoginHref } from "@/lib/api/client";

/** 로그인 상태. 카카오로 로그인했으면 user가 있다 */
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000, retry: false });
}

/** 지금 보고 있는 주소 (쿼리 포함). 로그인 후 여기로 돌아온다 */
export function useCurrentPath(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.delete("login");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function KakaoSymbol() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.6c-.1.3.3.6.6.4l4.3-2.8c.5.1 1 .1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
    </svg>
  );
}

/**
 * 카카오 로그인 버튼. 카카오 화면으로 갔다가 returnTo로 돌아온다.
 * 입력 중인 요청 초안은 브라우저에 저장돼 있어 다녀와도 그대로 남는다.
 */
export function KakaoLoginButton({ returnTo, label = "카카오로 시작하기" }: { returnTo: string; label?: string }) {
  return (
    <a className="kakao-login" href={kakaoLoginHref(returnTo)}>
      <KakaoSymbol />
      {label}
    </a>
  );
}

/**
 * 로그인이 필요한 곳(내 정보·알림)을 눌렀을 때 아래에서 올라오는 안내.
 * 헤더(backdrop-filter) 안에 두면 position: fixed가 헤더 기준이 되어 깨지므로 body에 그린다.
 */
export function LoginSheet({ open, onClose, returnTo, title }: { open: boolean; onClose: () => void; returnTo: string; title: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>(".kakao-login")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="login-sheet" role="presentation" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="login-sheet-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" aria-label="닫기" onClick={onClose}>
          <X />
        </button>
        <h2 id="login-sheet-title">{title}</h2>
        <p>카카오로 3초 만에 시작하고, 매물 제안과 알림을 받아보세요.</p>
        <KakaoLoginButton returnTo={returnTo} />
      </div>
    </div>,
    document.body,
  );
}

/** 페이지 안에서 로그인이 필요할 때 보여주는 안내 */
export function LoginPrompt({ title, description, returnTo }: { title: string; description: string; returnTo: string }) {
  return (
    <div className="login-prompt">
      <h2>{title}</h2>
      <p>{description}</p>
      <KakaoLoginButton returnTo={returnTo} />
    </div>
  );
}

const LOGIN_RESULT: Record<string, string> = {
  failed: "카카오 로그인에 실패했어요. 다시 시도해주세요.",
  cancelled: "카카오 로그인을 취소했어요.",
  unavailable: "카카오 로그인을 준비 중이에요. 잠시 후 다시 시도해주세요.",
};

/** 카카오에서 돌아왔을 때 ?login=… 결과를 알려주고 주소에서 지운다 */
export function LoginResultToast() {
  const router = useRouter();
  const path = useCurrentPath();
  const searchParams = useSearchParams();
  const result = searchParams.get("login");
  useEffect(() => {
    if (!result) return;
    toast(LOGIN_RESULT[result] ?? LOGIN_RESULT.failed);
    router.replace(path);
  }, [result, path, router]);
  return null;
}
