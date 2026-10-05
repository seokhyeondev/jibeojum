export interface CommuteSummary {
  totalMinutes: number;
  walkMinutes: number;
  busMinutes: number;
  subwayMinutes: number;
  transferCount: number;
  fare?: number;
  routeSummary: string;
  calculatedAt: string;
  provider: "tmap" | "odsay" | "internal";
}

/** 상세 경로의 한 구간 */
export interface RouteLeg {
  mode: "walk" | "bus" | "subway" | "train" | "etc";
  minutes: number;
  distanceM: number;
  /** 노선 이름 (예: 9호선(급행), 3412) */
  line: string | null;
  /** 노선 색 (#RRGGBB) */
  color: string | null;
  /** 타는 곳·내리는 곳 */
  from: string | null;
  to: string | null;
  /** 지나는 정류장·역 수 */
  stops: number | null;
}

/** 매물에서 출근지까지 상세 경로 (평일 오전 8시 출발 기준 가장 빠른 경로) */
export interface CommuteRoute {
  totalMinutes: number;
  walkMinutes: number;
  transferCount: number;
  fare: number | null;
  legs: RouteLeg[];
  calculatedAt: string;
}
