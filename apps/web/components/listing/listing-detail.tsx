"use client";

import { Check, ChevronLeft, ChevronRight, Heart, MapPin, Minus, TrainFront } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { SimpleHead } from "@/components/navigation/simple-head";
import { Button } from "@/components/ui/button";
import { HOUSING_TYPE_CHOICES, INFRA_CHOICES, SAFETY_CHOICES, choiceLabel } from "@zipazum/shared";
import {
  formatBuilding,
  formatDateTime,
  formatFloor,
  formatManwon,
  formatMoveIn,
  formatPrice,
  commuteSourceNote,
  formatTransfers,
} from "@zipazum/shared";
import { useFavorites } from "@/lib/store/app-store";
import { ReasonList } from "./reason-list";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingBlock } from "@/components/common/hydrated";
import { SearchX } from "lucide-react";
import { useCriteria, useNow, useRecommendations } from "./use-recommendations";
import { isExternal, listingImages } from "./listing-photo";
import { ReportListing } from "./report-listing";

export function ListingDetail({ id }: { id: string }) {
  const criteria = useCriteria();
  const now = useNow();
  const { isPending, error, refetch, recommendations } = useRecommendations();
  const { favorites, toggle } = useFavorites();
  const [imageIndex, setImageIndex] = useState(0);

  const index = recommendations.findIndex((item) => item.listing.id === id);
  const recommendation = recommendations[index];
  if (isPending) return <LoadingBlock />;
  if (error) {
    return (
      <section className="detail">
        <SimpleHead title="매물 상세" fallbackHref="/listings" />
        <ErrorState error={error} onRetry={refetch} />
      </section>
    );
  }
  if (!recommendation) {
    return (
      <section className="detail">
        <SimpleHead title="매물 상세" fallbackHref="/listings" />
        <div className="results">
          <EmptyState
            icon={<SearchX />}
            title="매물을 찾을 수 없어요"
            description="거래가 끝났거나 내 요청에 제안된 매물이 아니에요."
            actionLabel="매물 목록 보기"
            actionHref="/listings"
          />
        </div>
      </section>
    );
  }

  const { listing } = recommendation;
  const { agent } = listing;
  const favorite = favorites.includes(listing.id);
  const destination = criteria.commuteDestination.label.trim() || "출근지";
  const images = listingImages(listing.images);
  const image = images[imageIndex] ?? images[0];
  const { commute } = listing;
  const imageCount = images.length;

  const heart = (
    <button
      type="button"
      className={favorite ? "red" : ""}
      onClick={() => toggle(listing.id)}
      aria-pressed={favorite}
      aria-label={favorite ? "찜 해제" : "찜하기"}
    >
      <Heart fill={favorite ? "currentColor" : "none"} />
    </button>
  );

  const specs: [string, string][] = [
    ["전용면적", `${listing.exclusiveAreaM2}㎡`],
    ["층수", formatFloor(listing)],
    ["관리비", `${formatManwon(listing.maintenanceFee)}원`],
    ["입주 가능일", formatMoveIn(listing)],
    ["건물", formatBuilding(listing.builtYear, now)],
    ["주차", listing.options.includes("parking") ? "가능" : "불가·협의"],
  ];

  return (
    <section className="detail">
      <SimpleHead title="매물 상세" fallbackHref="/listings" action={heart} />
      <div className="hero-photo">
        <Image src={image.src} alt={image.alt} fill sizes="760px" preload unoptimized={isExternal(image.src)} />
        {imageCount > 1 && (
          <>
            <button
              type="button"
              className="hero-nav prev"
              aria-label="이전 사진"
              onClick={() => setImageIndex((imageIndex - 1 + imageCount) % imageCount)}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="hero-nav next"
              aria-label="다음 사진"
              onClick={() => setImageIndex((imageIndex + 1) % imageCount)}
            >
              <ChevronRight />
            </button>
          </>
        )}
        <span>
          {imageIndex + 1} / {imageCount}
        </span>
      </div>
      <div className="detail-body">
        <small className="green">
          {choiceLabel(HOUSING_TYPE_CHOICES, listing.housingType)} · 추천 {index + 1}위
        </small>
        <h1>{listing.title}</h1>
        <strong>{formatPrice(listing)}</strong>
        <p className="address">
          <MapPin aria-hidden />
          {listing.address}
        </p>
        <div className="commute">
          <div>
            <TrainFront aria-hidden />
            <span>
              <small>{destination}까지</small>
              <b>{commute.totalMinutes}분</b>
            </span>
          </div>
          <p>
            {listing.station.name} 도보 {listing.station.walkMinutes}분
            <br />
            {formatTransfers(commute.transferCount)}
          </p>
        </div>
        <div className="route">
          <p>{commute.routeSummary}</p>
          <ul>
            <li>도보 {commute.walkMinutes}분</li>
            {commute.busMinutes > 0 && <li>버스 {commute.busMinutes}분</li>}
            {commute.subwayMinutes > 0 && <li>지하철 {commute.subwayMinutes}분</li>}
            <li>{formatTransfers(commute.transferCount)}</li>
          </ul>
          <small>{commuteSourceNote(commute)}</small>
        </div>
        <div className="spec">
          {specs.map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <b>{value}</b>
            </div>
          ))}
        </div>
        <section>
          <h2>내 조건과 비교</h2>
          <ReasonList recommendation={recommendation} />
        </section>
        <section>
          <h2>안심 조건</h2>
          <ul className="checklist">
            {SAFETY_CHOICES.map((choice) => {
              const has = listing.security.includes(choice.value);
              const wanted = criteria.safetyOptions.includes(choice.value);
              return (
                <li key={choice.value} className={`${has ? "has" : "none"}${wanted ? " wanted" : ""}`}>
                  {has ? <Check aria-hidden /> : <Minus aria-hidden />}
                  <span>{choice.label}</span>
                  <span className="sr-only">{has ? "있음" : "없음"}</span>
                  {wanted && <em>내 조건</em>}
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h2>주변 시설</h2>
          <ul className="facilities">
            {[...listing.nearby]
              .sort((a, b) => a.walkMinutes - b.walkMinutes)
              .map((facility) => (
                <li key={`${facility.type}-${facility.name}`}>
                  <small>{choiceLabel(INFRA_CHOICES, facility.type)}</small>
                  <span>{facility.name}</span>
                  <b>도보 {facility.walkMinutes}분</b>
                </li>
              ))}
          </ul>
        </section>
        <section>
          <h2>이 집의 특징</h2>
          <div className="mini">
            {listing.tags.map((tag) => (
              <i key={tag}>{tag}</i>
            ))}
          </div>
          <p>{listing.description}</p>
        </section>
        <div className="agent">
          <i>{agent.name.slice(0, 1)}</i>
          <span>
            <b>{agent.name} 공인중개사</b>
            <small>
              {agent.officeName} · {formatDateTime(listing.verifiedAt)} 확인
            </small>
          </span>
          <em>확인</em>
        </div>
      </div>
      <ReportListing listingId={listing.id} />
      <div className="detail-cta">
        <button type="button" onClick={() => toggle(listing.id)} aria-pressed={favorite}>
          <Heart fill={favorite ? "currentColor" : "none"} aria-hidden />
          <small>찜</small>
        </button>
        <Button asChild>
          <Link href={`/messages?listing=${listing.id}`}>문의·방문 요청</Link>
        </Button>
      </div>
    </section>
  );
}
