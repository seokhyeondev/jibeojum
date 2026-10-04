"use client";

import { Scale } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { SimpleHead } from "@/components/navigation/simple-head";
import { Button } from "@/components/ui/button";
import { INFRA_CHOICES, SAFETY_CHOICES, choiceLabel } from "@/data/options";
import {
  formatBuilding,
  formatFloor,
  formatManwon,
  formatMoveIn,
  formatPrice,
  formatTransfers,
} from "@/lib/format";
import type { Listing } from "@/types/listing";
import { useCompare } from "@/lib/store/app-store";
import { useCriteria, useNow, useRecommendations } from "./use-recommendations";

const NEAR_WALK_MINUTES = 10;

export function CompareView() {
  const { selected, max } = useCompare();
  const criteria = useCriteria();
  const now = useNow();
  const recommendations = useRecommendations();
  const items = selected
    .map((id) => recommendations.find((item) => item.listing.id === id)?.listing)
    .filter((listing): listing is Listing => listing !== undefined);

  if (items.length < max) {
    return (
      <section className="compare">
        <SimpleHead title="매물 비교" fallbackHref="/listings" />
        <EmptyState
          icon={<Scale />}
          title="비교할 매물을 골라주세요"
          description={`매물 목록에서 ${max}개를 비교함에 담으면 조건을 나란히 볼 수 있어요.`}
          actionLabel="매물 목록 보기"
          actionHref="/listings"
        />
      </section>
    );
  }

  const destination = criteria.commuteDestination.label.trim() || "출근지";
  const rows: [string, (listing: Listing) => string][] = [
    ["가격", formatPrice],
    ["출근시간", (x) => `${destination} ${x.commute.totalMinutes}분`],
    ["환승", (x) => formatTransfers(x.commute.transferCount)],
    ["면적", (x) => `${x.exclusiveAreaM2}㎡`],
    ["층수", formatFloor],
    ["건물", (x) => formatBuilding(x.builtYear, now)],
    ["주차", (x) => (x.options.includes("parking") ? "가능" : "불가·협의")],
    ["역과 거리", (x) => `${x.station.name} 도보 ${x.station.walkMinutes}분`],
    ["관리비", (x) => `${formatManwon(x.maintenanceFee)}원`],
    ["입주일", formatMoveIn],
    ["안심 조건", (x) => x.security.map((s) => choiceLabel(SAFETY_CHOICES, s)).join(", ") || "-"],
    [
      "가까운 시설",
      (x) =>
        [...new Set(x.nearby.filter((f) => f.walkMinutes <= NEAR_WALK_MINUTES).map((f) => choiceLabel(INFRA_CHOICES, f.type)))].join(", ") || "-",
    ],
  ];

  return (
    <section className="compare">
      <SimpleHead title="매물 비교" fallbackHref="/listings" />
      <p>두 매물의 중요한 조건을 한눈에 비교해보세요.</p>
      <div className="table">
        <div className="compare-photos">
          <i />
          {items.map((x) => (
            <Link key={x.id} href={`/listings/${x.id}`}>
              <Image src={x.images[0].src} alt="" fill sizes="40vw" />
              <b>{x.title}</b>
            </Link>
          ))}
        </div>
        {rows.map(([label, value]) => (
          <div className="row" key={label}>
            <b>{label}</b>
            {items.map((x) => (
              <span key={x.id}>{value(x)}</span>
            ))}
          </div>
        ))}
      </div>
      <Button asChild className="primary wide">
        <Link href={`/listings/${items[0].id}`}>첫 번째 매물 자세히 보기</Link>
      </Button>
    </section>
  );
}
