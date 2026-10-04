export interface TransitRouteInput {
  /** 출발 경도 */
  startX: number;
  /** 출발 위도 */
  startY: number;
  endX: number;
  endY: number;
  /** yyyymmddhhmi. 이 시각에 출발하는 경로 */
  searchDateTime?: string;
}

export interface TransitItinerary {
  totalMinutes: number;
  transferCount: number;
  walkMinutes: number;
  fare: number | null;
  /** 1 지하철, 2 버스, 3 버스+지하철, 4 고속/시외버스, 5 기차, 6 항공, 7 해운 */
  pathType: number;
  totalDistanceM: number | null;
}

export interface TransitRouteResult {
  provider: string;
  itineraries: TransitItinerary[];
  /** 가장 빠른 경로 */
  best: TransitItinerary | null;
  /** 환승 없는 경로 중 가장 빠른 것 */
  bestNoTransfer: TransitItinerary | null;
}

export interface TransitRouteProvider {
  readonly name: string;
  getRoutes(input: TransitRouteInput): Promise<TransitRouteResult>;
}

export const TRANSIT_ROUTE_PROVIDER = Symbol("TRANSIT_ROUTE_PROVIDER");

export class TransitProviderError extends Error {}

/** 일일·월간 호출 한도 초과. 재시도해도 소용없으므로 바로 멈춘다 */
export class TransitQuotaError extends TransitProviderError {}

/** 경로 목록에서 가장 빠른 것과 환승 없는 것 중 가장 빠른 것을 고른다 */
export function summarizeItineraries(provider: string, itineraries: TransitItinerary[]): TransitRouteResult {
  const fastest = (list: TransitItinerary[]) =>
    list.reduce<TransitItinerary | null>((best, it) => (!best || it.totalMinutes < best.totalMinutes ? it : best), null);
  return {
    provider,
    itineraries,
    best: fastest(itineraries),
    bestNoTransfer: fastest(itineraries.filter((it) => it.transferCount === 0)),
  };
}
