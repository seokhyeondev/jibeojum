import {
  summarizeItineraries,
  TransitProviderError,
  TransitQuotaError,
  type TransitItinerary,
  type TransitRouteInput,
  type TransitRouteProvider,
  type TransitRouteResult,
} from "./transit.types.js";

interface TmapItinerary {
  totalTime?: number;
  transferCount?: number;
  totalWalkTime?: number;
  totalDistance?: number;
  pathType?: number;
  fare?: { regular?: { totalFare?: number } };
}

interface TmapResponse {
  metaData?: { plan?: { itineraries?: TmapItinerary[] } };
  result?: { status?: number; message?: string };
  error?: { id?: string; code?: string; message?: string };
}

/** TMAP 응답을 공통 형식으로 바꾼다. 경로가 없다는 응답(result)은 빈 목록으로 본다. */
export function parseTmapResponse(body: TmapResponse): TransitItinerary[] {
  if (body.error) throw new TransitProviderError(`tmap: ${body.error.code ?? ""} ${body.error.message ?? ""}`.trim());
  const itineraries = body.metaData?.plan?.itineraries ?? [];
  return itineraries
    .filter((it) => typeof it.totalTime === "number")
    .map((it) => ({
      totalMinutes: Math.round((it.totalTime ?? 0) / 60),
      transferCount: it.transferCount ?? 0,
      walkMinutes: Math.round((it.totalWalkTime ?? 0) / 60),
      fare: it.fare?.regular?.totalFare ?? null,
      pathType: it.pathType ?? 0,
      totalDistanceM: it.totalDistance ?? null,
    }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SK open API TMAP 대중교통 (요약 API /transit/routes/sub).
 * 짧은 시간에 연달아 부르면 429를 돌려주므로 호출 간격을 두고, 429는 기다렸다가 다시 시도한다.
 */
export class TmapTransitProvider implements TransitRouteProvider {
  readonly name = "tmap";
  private nextSlot = 0;

  constructor(
    private readonly appKey: string,
    private readonly url = "https://apis.openapi.sk.com/transit/routes/sub",
    private readonly options: { minIntervalMs?: number; retries?: number } = {},
  ) {}

  async getRoutes(input: TransitRouteInput): Promise<TransitRouteResult> {
    const retries = this.options.retries ?? 3;
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      try {
        return await this.request(input);
      } catch (error) {
        const tooMany = error instanceof TransitProviderError && !(error instanceof TransitQuotaError) && error.message.includes("HTTP 429");
        if (!tooMany || attempt >= retries) throw error;
        await sleep(1500 * 2 ** attempt);
      }
    }
  }

  private async throttle() {
    const interval = this.options.minIntervalMs ?? 1000;
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + interval;
    if (slot > now) await sleep(slot - now);
  }

  private async request(input: TransitRouteInput): Promise<TransitRouteResult> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { appKey: this.appKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        startX: String(input.startX),
        startY: String(input.startY),
        endX: String(input.endX),
        endY: String(input.endY),
        count: 10,
        format: "json",
        ...(input.searchDateTime ? { searchDttm: input.searchDateTime } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => ({}))) as TmapResponse;
    if (body.error?.code === "QUOTA_EXCEEDED" || (response.status === 429 && /limit exceeded/i.test(body.error?.message ?? ""))) {
      throw new TransitQuotaError("tmap: 호출 한도 초과 (Limit Exceeded)");
    }
    if (!response.ok) throw new TransitProviderError(`tmap: HTTP ${response.status} ${body.error?.message ?? ""}`.trim());
    return summarizeItineraries(this.name, parseTmapResponse(body));
  }
}
