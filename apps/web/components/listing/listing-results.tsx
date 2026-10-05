"use client";

import { ClipboardList, MapPin, SearchX, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingBlock } from "@/components/common/hydrated";
import { SimpleHead } from "@/components/navigation/simple-head";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@zipazum/shared";
import { fetchMyRequests } from "@/lib/api/client";
import { useCompare, useFavorites, useSubmittedRequest } from "@/lib/store/app-store";
import { ListingCard } from "./listing-card";
import { useCriteria, useRecommendations } from "./use-recommendations";

type SortKey = "recommend" | "commute" | "rent";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "추천순" },
  { key: "commute", label: "출근 빠른순" },
  { key: "rent", label: "월세 낮은순" },
];

function sortRecommendations<T extends Recommendation>(items: T[], key: SortKey): T[] {
  if (key === "recommend") return items;
  const value = (item: T) =>
    key === "commute" ? item.listing.commute.totalMinutes : item.listing.monthlyRent;
  return [...items].sort((a, b) => value(a) - value(b));
}

/** ?request=<id>로 들어오면 그 요청을 현재 요청으로 바꾼다. 바꾸는 중이면 true */
function useRequestFromQuery(): boolean {
  const requestId = useSearchParams().get("request");
  const [current, setCurrent] = useSubmittedRequest();
  const needsSwitch = Boolean(requestId && requestId !== current?.id);
  const { data: mine, isFetched } = useQuery({ queryKey: ["my-requests"], queryFn: fetchMyRequests, enabled: needsSwitch, retry: false });
  const found = needsSwitch ? mine?.find((r) => r.id === requestId) : undefined;
  useEffect(() => {
    if (found) setCurrent(found);
  }, [found, setCurrent]);
  // 내 요청이 아니면 지금 요청 그대로 보여준다
  return needsSwitch && (!isFetched || Boolean(found));
}

export function ListingResults() {
  const switching = useRequestFromQuery();
  return (
    <>
      <SimpleHead title="요청한 매물" fallbackHref="/requests" />
      {switching ? <LoadingBlock /> : <Results />}
    </>
  );
}

function Results() {
  const router = useRouter();
  const criteria = useCriteria();
  const { hasRequest, isPending, error, refetch, recommendations } = useRecommendations();
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { selected, toggle: togglePick, max } = useCompare();
  const [sort, setSort] = useState<SortKey>("recommend");
  const sorted = useMemo(() => sortRecommendations(recommendations, sort), [recommendations, sort]);
  const destination = criteria.commuteDestination.label.trim() || "출근지";
  const count = recommendations.length;

  const pick = (id: string) => {
    if (togglePick(id) === "replaced") toast("먼저 담은 매물을 빼고 새로 담았어요.");
  };

  if (!hasRequest) {
    return (
      <section className="results">
        <EmptyState
          icon={<ClipboardList />}
          title="먼저 매물 요청을 보내주세요"
          description="출근지와 예산을 알려주시면 중개사가 확인한 매물을 제안해드려요."
          actionLabel="매물 요청 시작하기"
          actionHref="/request?step=1"
        />
      </section>
    );
  }
  if (isPending) return <LoadingBlock />;
  if (error) {
    return (
      <section className="results">
        <ErrorState error={error} onRetry={refetch} />
      </section>
    );
  }
  if (count === 0) {
    return (
      <section className="results">
        <EmptyState
          icon={<SearchX />}
          title="아직 도착한 매물이 없어요"
          description="중개사가 확인 중이에요. 24시간 안에 제안이 도착하지 않으면 조건을 조금 완화해보세요."
          actionLabel="조건 수정하기"
          actionHref="/request?step=1"
        />
      </section>
    );
  }

  return (
    <section className="results">
      <div className="result-head">
        <div>
          <span className="eyebrow">매물 제안 도착</span>
          <h1>
            조건에 맞는 매물 <b>{count}개</b>를
            <br />
            찾았어요
          </h1>
          <p>
            <MapPin aria-hidden />
            {destination} · {criteria.maxCommuteMinutes}분 이내
            {criteria.noTransferExtraMinutes > 0 && ` (환승 없으면 ${criteria.maxCommuteMinutes + criteria.noTransferExtraMinutes}분)`}
          </p>
        </div>
        <i>
          <b>{count}</b>
          <small>제안</small>
        </i>
      </div>
      <div className="toolbar">
        <div className="sorts" role="radiogroup" aria-label="정렬">
          {SORTS.map((item) => (
            <button
              type="button"
              role="radio"
              aria-checked={sort === item.key}
              className={sort === item.key ? "on" : ""}
              onClick={() => setSort(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Link href="/request?step=1">
          <SlidersHorizontal aria-hidden />
          조건
        </Link>
      </div>
      <div className="cards">
        {sorted.map((item) => (
          <ListingCard
            key={item.listing.id}
            recommendation={item}
            rank={sort === "recommend" ? recommendations.indexOf(item) + 1 : null}
            destination={destination}
            favorite={favorites.includes(item.listing.id)}
            onToggleFavorite={() => toggleFavorite(item.listing.id)}
            picked={selected.includes(item.listing.id)}
            onTogglePick={() => pick(item.listing.id)}
          />
        ))}
      </div>
      {selected.length > 0 && (
        <div className="comparebar">
          <span>
            <b>
              {selected.length}/{max}
            </b>
            <small>매물을 선택했어요</small>
          </span>
          <Button disabled={selected.length < max} onClick={() => router.push("/compare")}>
            비교하기
          </Button>
        </div>
      )}
    </section>
  );
}
