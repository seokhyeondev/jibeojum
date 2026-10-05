"use client";

import { Heart, TrainFront } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { HOUSING_TYPE_CHOICES, choiceLabel } from "@zipazum/shared";
import { formatFloor, formatPrice, formatTransfers } from "@zipazum/shared";
import type { Recommendation } from "@zipazum/shared";
import { ReasonList } from "./reason-list";
import { isExternal, listingImages } from "./listing-photo";

interface Props {
  recommendation: Recommendation;
  rank: number | null;
  destination: string;
  favorite: boolean;
  onToggleFavorite: () => void;
  picked: boolean;
  onTogglePick: () => void;
}

export function ListingCard({ recommendation, rank, destination, favorite, onToggleFavorite, picked, onTogglePick }: Props) {
  const { listing, commuteFit } = recommendation;
  const href = `/listings/${listing.id}`;
  const cover = listingImages(listing.images)[0];
  return (
    <article className={listing.status === "expired" ? "expired" : undefined}>
      <Link className="photo" href={href} aria-label={`${listing.title} 상세 보기`}>
        <Image src={cover.src} alt={cover.alt} fill sizes="(max-width:600px) 100vw,360px" unoptimized={isExternal(cover.src)} />
        <span className="badges">
          {listing.sample && <em className="alt">시범 매물</em>}
          {rank !== null && <em>추천 {rank}위</em>}
          {commuteFit === "no_transfer_extra" && <em className="alt">환승 없는 추천</em>}
          {listing.status === "expired" && <em className="gone">거래 완료</em>}
        </span>
      </Link>
      <button
        type="button"
        className={favorite ? "heart on" : "heart"}
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? "찜 해제" : "찜하기"}
      >
        <Heart fill={favorite ? "currentColor" : "none"} />
      </button>
      <Link className="card-body" href={href}>
        <small>{choiceLabel(HOUSING_TYPE_CHOICES, listing.housingType)}</small>
        <h2>{listing.title}</h2>
        <b>{formatPrice(listing)}</b>
        <p>
          <span>
            <TrainFront aria-hidden />
            {destination} {listing.commute.totalMinutes}분 · {formatTransfers(listing.commute.transferCount)}
          </span>
          {listing.partnerCommute && (
            <span>
              <TrainFront aria-hidden />
              같이 사는 분 {listing.partnerCommute.totalMinutes}분 · {formatTransfers(listing.partnerCommute.transferCount)}
            </span>
          )}
          <span>
            {listing.exclusiveAreaM2}㎡ · {formatFloor(listing)}
          </span>
        </p>
        <ReasonList recommendation={recommendation} limit={3} />
        <div className="mini">
          {listing.tags.map((tag) => (
            <i key={tag}>{tag}</i>
          ))}
        </div>
      </Link>
      <label className="pick">
        <Checkbox checked={picked} onCheckedChange={onTogglePick} />
        비교함에 담기
      </label>
    </article>
  );
}
