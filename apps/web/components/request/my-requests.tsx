"use client";

import { ClipboardList } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@zipazum/shared";
import { requestConditionLabels, summarizeRequest, type HousingRequest } from "@zipazum/shared";
import { cancelRequest, fetchMyRequests, fetchProposals } from "@/lib/api/client";
import { useSubmittedRequest } from "@/lib/store/app-store";

const STATUS_LABEL = {
  submitted: "접수됨",
  matching: "진행 중",
  proposed: "제안 도착",
  closed: "취소됨",
} as const;

/** 진행 단계: 접수 → 공인중개사 확인 중 → 제안 도착 */
const PROGRESS: Record<HousingRequest["status"], number> = { submitted: 25, matching: 60, proposed: 100, closed: 100 };

export function MyRequests() {
  const [current] = useSubmittedRequest();
  // 요청은 여러 개일 수 있다. 서버 목록(최신순)을 보여주고, 카드를 누르면 그 요청의 매물로 간다
  const { data: requests = current ? [current] : [] } = useQuery({ queryKey: ["my-requests"], queryFn: fetchMyRequests, retry: false });
  return (
    <section className="requests">
      <span className="eyebrow">MY REQUEST</span>
      <h1>내 매물 요청</h1>
      {requests.length > 0 ? (
        requests.map((request) => <RequestCard key={request.id} request={request} current={request.id === current?.id} />)
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

function RequestCard({ request, current }: { request: HousingRequest; current: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentRequest, setCurrent] = useSubmittedRequest();
  const [cancelling, setCancelling] = useState(false);
  const closed = request.status === "closed";
  // 매물 탭과 같은 캐시 키를 써서 다시 받지 않는다
  const { data: proposals } = useQuery({ queryKey: ["proposals", request.id], queryFn: () => fetchProposals(request.id), retry: false });
  const count = proposals?.length ?? 0;
  const progress = count > 0 ? 100 : PROGRESS[request.status];
  return (
    <div className={["request-card", current && "current", closed && "closed"].filter(Boolean).join(" ")}>
      <header>
        <span>{count > 0 && request.status !== "closed" ? STATUS_LABEL.proposed : STATUS_LABEL[request.status]}</span>
        <small>{formatDateTime(request.submittedAt)} 접수</small>
      </header>
      <h2>{request.commuteDestination.label} 출근 · 맞춤 매물 요청</h2>
      <p>{summarizeRequest(request)}</p>
      <div className="mini">
        {requestConditionLabels(request).map((label) => (
          <i key={label}>{label}</i>
        ))}
      </div>
      <div
        className={request.status === "closed" ? "small-progress closed" : "small-progress"}
        role="progressbar"
        aria-label="진행 상황"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="count">
        <span>제안 도착</span>
        <b>{proposals ? `${count}개` : "-"}</b>
      </div>
      <Button
        type="button"
        className="primary wide"
        onClick={() => {
          setCurrent(request);
          router.push(`/listings?request=${request.id}`);
        }}
      >
        제안 확인하기
      </Button>
      {!closed && (
        <button
          type="button"
          className="request-cancel"
          disabled={cancelling}
          onClick={async () => {
            if (!window.confirm("이 요청을 취소할까요? 공인중개사에게 더 이상 매물을 받지 않아요.")) return;
            setCancelling(true);
            try {
              const cancelled = await cancelRequest(request.id);
              if (currentRequest?.id === cancelled.id) setCurrent(cancelled);
              await queryClient.invalidateQueries({ queryKey: ["my-requests"] });
              toast("요청을 취소했어요.");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.");
            } finally {
              setCancelling(false);
            }
          }}
        >
          {cancelling ? "취소하는 중…" : "요청 취소"}
        </button>
      )}
    </div>
  );
}
