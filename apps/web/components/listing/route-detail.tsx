"use client";

import { Bus, Footprints, TrainFront } from "lucide-react";
import type { CommuteRoute, CommuteSummary, RouteLeg } from "@zipazum/shared";
import { commuteSourceNote, formatTransfers } from "@zipazum/shared";

const ICON = { walk: Footprints, bus: Bus, subway: TrainFront, train: TrainFront, etc: Bus } as const;

function legTitle(leg: RouteLeg, last: boolean): string {
  if (leg.mode === "walk") return leg.to ? `${leg.to}까지 걷기` : last ? "출근지까지 걷기" : "걷기";
  const line = leg.line ?? (leg.mode === "bus" ? "버스" : "지하철");
  return leg.mode === "bus" ? `${line}번 버스` : line;
}

function legDetail(leg: RouteLeg): string | null {
  if (leg.mode === "walk") return leg.distanceM ? `${leg.distanceM.toLocaleString()}m` : null;
  const span = leg.from && leg.to ? `${leg.from} → ${leg.to}` : null;
  const stops = leg.stops ? `${leg.stops}${leg.mode === "bus" ? "정류장" : "개 역"}` : null;
  return [span, stops].filter(Boolean).join(" · ") || null;
}

/** 출근 경로: 상세 경로(구간별)가 있으면 그것을, 없으면 요약을 보여준다 */
export function RouteDetail({ commute, route, loading }: { commute: CommuteSummary; route: CommuteRoute | null | undefined; loading: boolean }) {
  if (route) {
    return (
      <div className="route">
        <p>
          {formatTransfers(route.transferCount)} · 도보 {route.walkMinutes}분{route.fare ? ` · ${route.fare.toLocaleString()}원` : ""}
        </p>
        <ol className="route-legs">
          {route.legs.map((leg, i) => {
            const Icon = ICON[leg.mode];
            const detail = legDetail(leg);
            return (
              <li key={i} className={leg.mode} style={leg.color ? { ["--leg" as string]: leg.color } : undefined}>
                <i aria-hidden>
                  <Icon />
                </i>
                <span>
                  <b>{legTitle(leg, i === route.legs.length - 1)}</b>
                  {detail && <small>{detail}</small>}
                </span>
                <em>{leg.minutes}분</em>
              </li>
            );
          })}
        </ol>
        <small>평일 오전 8시 출발 기준 가장 빠른 대중교통 경로예요. 교통 상황에 따라 달라질 수 있어요.</small>
      </div>
    );
  }
  return (
    <div className="route">
      <p>{commute.routeSummary}</p>
      <ul>
        <li>도보 {commute.walkMinutes}분</li>
        {commute.busMinutes > 0 && <li>버스 {commute.busMinutes}분</li>}
        {commute.subwayMinutes > 0 && <li>지하철 {commute.subwayMinutes}분</li>}
        <li>{formatTransfers(commute.transferCount)}</li>
      </ul>
      <small>{loading ? "실제 경로를 불러오는 중이에요…" : commuteSourceNote(commute)}</small>
    </div>
  );
}
