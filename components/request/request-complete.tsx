"use client";

import { Check, ClipboardList, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { getProposedListings } from "@/lib/api/listings";
import { requestConditionLabels, summarizeRequest } from "@/lib/request-summary";
import { useSubmittedRequest } from "@/lib/store/app-store";
import { RequestTimeline } from "./request-timeline";

export function RequestComplete() {
  const [request] = useSubmittedRequest();
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
  const count = getProposedListings().length;
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
        <Link href="/request?step=1">수정</Link>
      </div>
      <RequestTimeline />
      <div className="notice">
        <Sparkles aria-hidden />
        프로토타입에서는 준비된 샘플 매물을 바로 확인할 수 있어요.
      </div>
      <Button asChild className="primary wide">
        <Link href="/listings">도착한 매물 {count}개 보기</Link>
      </Button>
    </section>
  );
}
