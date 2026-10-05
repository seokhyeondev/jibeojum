"use client";

import { BellRing, Check, ClipboardList, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { useProposals } from "@/components/listing/use-recommendations";
import { useDraft, useSubmittedRequest } from "@/lib/store/app-store";
import { draftFromRequest, requestConditionLabels, summarizeRequest } from "@zipazum/shared";
import { RequestTimeline } from "./request-timeline";

export function RequestComplete() {
  const router = useRouter();
  const [request] = useSubmittedRequest();
  const { reset } = useDraft();
  const { data: proposals } = useProposals();
  if (!request) {
    return (
      <section className="submitted">
        <EmptyState
          icon={<ClipboardList />}
          title="아직 보낸 요청이 없어요"
          description="출근지와 예산을 알려주시면 맞는 매물을 찾아드려요."
          actionLabel="매물 요청 시작하기"
          actionHref="/request?step=1"
        />
      </section>
    );
  }
  return (
    <section className="submitted">
      <div className="success">
        <Check aria-hidden />
      </div>
      <span className="eyebrow">요청 접수 완료</span>
      <h1>
        조건에 맞는 매물을
        <br />
        찾고 있어요
      </h1>
      <p>
        중개사에게 직접 확인한 매물만 모아
        <br />
        <b>24시간 안에</b> 제안해드릴게요.
      </p>
      <div className="summary">
        <MapPin aria-hidden />
        <span>
          {summarizeRequest(request)}
          <span className="mini">
            {requestConditionLabels(request).map((label) => (
              <i key={label}>{label}</i>
            ))}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            // 보낸 요청 값으로 초안을 채우고 수정 모드로 연다
            reset(draftFromRequest(request));
            router.push(`/request?step=1&edit=${request.id}`);
          }}
        >
          수정
        </button>
      </div>
      <RequestTimeline />
      {/* 링크를 잃어버려도 다시 들어오는 방법을 알려준다 */}
      <p className="return-note">
        <BellRing aria-hidden />
        <span>
          매물이 도착하면 알림으로 알려드려요.
          <br />
          카카오로 로그인하면 언제든 다시 볼 수 있어요.
        </span>
      </p>
      <Button asChild className="primary wide">
        <Link href={`/listings?request=${request.id}`}>{proposals ? `도착한 매물 ${proposals.length}개 보기` : "도착한 매물 보기"}</Link>
      </Button>
    </section>
  );
}
