"use client";

import { MapPin, SearchX, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/recommend";
import { useCompare, useFavorites } from "@/lib/store/app-store";
import { ListingCard } from "./listing-card";
import { useCriteria, useRecommendations } from "./use-recommendations";

type SortKey = "recommend" | "commute" | "rent";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "추천순" },
  { key: "commute", label: "출근 빠른순" },
  { key: "rent", label: "월세 낮은순" },
];

function sortRecommendations(items: Recommendation[], key: SortKey): Recommendation[] {
  if (key === "recommend") return items;
  const value = (item: Recommendation) =>
    key === "commute" ? item.listing.commute.totalMinutes : item.listing.monthlyRent;
  return [...items].sort((a, b) => value(a) - value(b));
}

export function ListingResults() {
  const router = useRouter();
  const criteria = useCriteria();
  const recommendations = useRecommendations();
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { selected, toggle: togglePick, max } = useCompare();
  const [sort, setSort] = useState<SortKey>("recommend");
  const sorted = useMemo(() => sortRecommendations(recommendations, sort), [recommendations, sort]);
  const destination = criteria.commuteDestination.label.trim() || "출근지";
  const count = recommendations.length;

  const pick = (id: string) => {
    if (togglePick(id) === "replaced") toast("먼저 담은 매물을 빼고 새로 담았어요.");
  };

  if (count === 0) {
    return (
      <section className="results">
        <EmptyState
          icon={<SearchX />}
          title="아직 도착한 매물이 없어요"
          description="조건을 조금 완화하면 더 많은 제안을 받을 수 있어요."
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
      <div className="sample-note">
        <Sparkles aria-hidden />
        프로토타입 샘플 매물이에요. 실제 주소·중개사가 아닙니다.
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
