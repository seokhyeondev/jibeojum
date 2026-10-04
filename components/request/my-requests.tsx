"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { getProposedListings } from "@/lib/api/listings";
import { formatDateTime } from "@/lib/format";
import { requestConditionLabels, summarizeRequest } from "@/lib/request-summary";
import { useSubmittedRequest } from "@/lib/store/app-store";

const STATUS_LABEL = {
  submitted: "접수됨",
  matching: "진행 중",
  proposed: "제안 도착",
  closed: "종료",
} as const;

export function MyRequests() {
  const [request] = useSubmittedRequest();
  return (
    <section className="requests">
      <span className="eyebrow">MY REQUEST</span>
      <h1>내 매물 요청</h1>
      {request ? (
        <div className="request-card">
          <header>
            <span>{STATUS_LABEL[request.status]}</span>
            <small>{formatDateTime(request.submittedAt)} 접수</small>
          </header>
          <h2>{request.commuteDestination.label} 출근 · 맞춤 매물 요청</h2>
          <p>{summarizeRequest(request)}</p>
          <div className="mini">
            {requestConditionLabels(request).map((label) => (
              <i key={label}>{label}</i>
            ))}
          </div>
          <div className="small-progress">
            <i />
          </div>
          <div className="count">
            <span>제안 도착</span>
            <b>{getProposedListings().length}개</b>
          </div>
          <Button asChild className="primary wide">
            <Link href="/listings">제안 확인하기</Link>
          </Button>
        </div>
      ) : (
        <EmptyState
          icon={<ClipboardList />}
          title="진행 중인 요청이 없어요"
          description="조건을 한 번만 입력하면 중개사가 확인한 매물을 제안해드려요."
          actionLabel="매물 요청 시작하기"
          actionHref="/request?step=1"
        />
      )}
    </section>
  );
}
