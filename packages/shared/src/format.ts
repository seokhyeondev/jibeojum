import type { CommuteSummary } from "./types/commute";
import type { Listing } from "./types/listing";

const numberFormat = new Intl.NumberFormat("ko-KR");

/** 숫자와 콤마만 남겨 만원 단위 정수로 바꾼다. 비어 있으면 null. */
export function parseManwon(input: string): number | null {
  const digits = input.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

export function formatNumber(value: number | null): string {
  return value === null ? "" : numberFormat.format(value);
}

/** 만원 단위 금액을 "1억 2,000만" 형태로 표시한다. */
export function formatManwon(value: number): string {
  const eok = Math.floor(value / 10000);
  const rest = value % 10000;
  if (eok === 0) return `${numberFormat.format(rest)}만`;
  return rest === 0 ? `${eok}억` : `${eok}억 ${numberFormat.format(rest)}만`;
}

export function formatPrice(listing: Pick<Listing, "transactionType" | "deposit" | "monthlyRent">): string {
  if (listing.transactionType === "jeonse") return `전세 ${formatManwon(listing.deposit)}`;
  return `보증금 ${formatManwon(listing.deposit)} / 월세 ${formatManwon(listing.monthlyRent)}`;
}

export function formatFloor(listing: Pick<Listing, "floor" | "totalFloors" | "floorType">): string {
  if (listing.floorType === "rooftop") return `옥탑 (${listing.totalFloors}층 건물)`;
  if (listing.floorType === "semi_basement") return "반지하";
  return `${listing.floor}층 / ${listing.totalFloors}층`;
}

export function buildingAge(builtYear: number, now: Date): number {
  return Math.max(0, now.getFullYear() - builtYear);
}

export function formatBuilding(builtYear: number, now: Date): string {
  const age = buildingAge(builtYear, now);
  const kind = age <= 5 ? "신축" : age <= 10 ? "준신축" : "구축";
  return `${kind} · ${builtYear}년 준공`;
}

export function formatTransfers(transferCount: number): string {
  return transferCount === 0 ? "환승 없음" : `환승 ${transferCount}회`;
}

export function formatMoveIn(listing: Pick<Listing, "availableFrom" | "moveInNote">): string {
  if (listing.moveInNote) return listing.moveInNote;
  if (!listing.availableFrom) return "즉시 입주";
  const [, month, day] = listing.availableFrom.split("-").map(Number);
  return `${month}월 ${day}일`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${year}년 ${month}월 ${day}일`;
}

/** 통근 정보 출처 안내. tmap: 실제 경로, internal: 걸어서 출근·직선거리 추정·샘플 매물 */
export function commuteSourceNote(commute: Pick<CommuteSummary, "provider" | "routeSummary">): string {
  if (commute.provider === "tmap" || commute.provider === "odsay") return "평일 오전 8시 출발 기준 대중교통 경로예요. 교통 상황에 따라 달라질 수 있어요.";
  if (commute.routeSummary.startsWith("걸어서")) return "출근지와 가까워 걸어서 가는 시간이에요.";
  if (commute.routeSummary.includes("동네 기준")) return "이 동네에서 출근지까지의 대표 경로 시간이에요.";
  if (commute.routeSummary.includes("추정")) return "직선거리로 추정한 시간이에요. 정확한 경로는 중개사에게 확인해주세요.";
  return "샘플 매물의 예시 경로예요.";
}
