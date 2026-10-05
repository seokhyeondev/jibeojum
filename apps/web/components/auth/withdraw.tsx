"use client";

import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { withdrawAccount } from "@/lib/api/client";
import { useDraft, useSubmittedRequest } from "@/lib/store/app-store";

/** 회원탈퇴: 무엇이 지워지는지 알려주고 한 번 더 확인한다 (앱 심사 요구사항: 앱 안에서 탈퇴 가능) */
export function WithdrawButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, setRequest] = useSubmittedRequest();
  const { reset } = useDraft();
  const [open, setOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setOpen(false);
    setAgree(false);
  };
  return (
    <>
      <button type="button" className="withdraw-link" onClick={() => setOpen(true)}>
        회원탈퇴
      </button>
      {open &&
        createPortal(
          <div className="login-sheet" role="presentation" onClick={close}>
            <div role="dialog" aria-modal="true" aria-labelledby="withdraw-title" className="report-sheet" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="close" aria-label="닫기" onClick={close}>
                <X />
              </button>
              <h2 id="withdraw-title">정말 탈퇴할까요?</h2>
              <ul className="withdraw-list">
                <li>보낸 매물 요청과 받은 매물 제안이 모두 지워져요.</li>
                <li>공인중개사와 나눈 대화, 알림도 지워져요.</li>
                <li>지운 기록은 되돌릴 수 없어요.</li>
              </ul>
              <label className="agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>위 내용을 확인했어요</span>
              </label>
              <button
                type="button"
                className="report-submit danger"
                disabled={!agree || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await withdrawAccount();
                    setRequest(null);
                    reset();
                    queryClient.clear();
                    toast("탈퇴했어요. 그동안 이용해주셔서 고마워요.");
                    router.replace("/");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.");
                    setBusy(false);
                  }
                }}
              >
                {busy ? "탈퇴하는 중…" : "탈퇴하기"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
