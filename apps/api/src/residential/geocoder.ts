export interface GeocodeResult {
  status: "ok" | "not_found" | "error";
  latitude?: number;
  longitude?: number;
  refinedAddress?: string;
  message?: string;
}

export interface Geocoder {
  readonly provider: string;
  geocodeParcel(address: string): Promise<GeocodeResult>;
}

interface VworldResponse {
  response?: {
    status?: "OK" | "NOT_FOUND" | "ERROR";
    result?: { point?: { x?: string; y?: string } };
    refined?: { text?: string };
    error?: { code?: string; text?: string };
  };
}

/** 브이월드 응답을 결과로 바꾼다. 좌표가 수도권 범위를 벗어나면 잘못 찾은 것으로 본다. */
export function parseVworldResponse(body: VworldResponse): GeocodeResult {
  const res = body.response;
  if (!res || res.status === "ERROR") return { status: "error", message: res?.error?.text ?? res?.error?.code ?? "unknown" };
  if (res.status === "NOT_FOUND") return { status: "not_found" };
  const longitude = Number(res.result?.point?.x);
  const latitude = Number(res.result?.point?.y);
  const insideCapitalArea = latitude > 36.8 && latitude < 38.4 && longitude > 125.9 && longitude < 127.9;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !insideCapitalArea) return { status: "not_found" };
  return { status: "ok", latitude, longitude, refinedAddress: res.refined?.text };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 브이월드 지오코더 (지번 주소 → WGS84 좌표).
 * 동시에 많이 부르면 연결을 끊으므로 호출 간격을 두고, 네트워크 오류는 점점 길게 기다리며 재시도한다.
 */
export class VworldGeocoder implements Geocoder {
  readonly provider = "vworld";
  private nextSlot = 0;

  constructor(
    private readonly apiKey: string,
    private readonly options: { minIntervalMs?: number; retries?: number } = {},
  ) {}

  async geocodeParcel(address: string): Promise<GeocodeResult> {
    const retries = this.options.retries ?? 4;
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      const result = await this.request(address);
      const retryable = result.status === "error" && !result.message?.startsWith("HTTP 4");
      if (!retryable || attempt >= retries) return result;
      await sleep(2000 * 2 ** attempt);
    }
  }

  /** 여러 작업이 동시에 불러도 호출 사이 간격을 보장한다 */
  private async throttle() {
    const interval = this.options.minIntervalMs ?? 150;
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + interval;
    if (slot > now) await sleep(slot - now);
  }

  private async request(address: string): Promise<GeocodeResult> {
    const params = new URLSearchParams({
      service: "address",
      request: "getcoord",
      version: "2.0",
      crs: "epsg:4326",
      address,
      refine: "true",
      simple: "false",
      format: "json",
      type: "parcel",
      key: this.apiKey,
    });
    try {
      const response = await fetch(`https://api.vworld.kr/req/address?${params}`, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return { status: "error", message: `HTTP ${response.status}` };
      return parseVworldResponse((await response.json()) as VworldResponse);
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : String(error) };
    }
  }
}

interface NaverGeocodeResponse {
  status?: string;
  addresses?: { jibunAddress?: string; x?: string; y?: string }[];
  errorMessage?: string;
}

/**
 * 네이버 지오코딩은 비슷한 주소도 돌려주므로, 결과 지번 주소에 요청한 번지가 그대로 있을 때만 성공으로 본다.
 * 요청 주소의 마지막 토큰이 번지(예: "1465-1")이고, 결과는 "… 신림동 1465-1 신사타운빌"처럼 건물명이 붙을 수 있다.
 */
export function parseNaverResponse(body: NaverGeocodeResponse, address: string): GeocodeResult {
  if (body.status && body.status !== "OK") return { status: "error", message: body.errorMessage ?? body.status };
  const lot = address.trim().split(/\s+/).at(-1) ?? "";
  const match = body.addresses?.find((a) => (a.jibunAddress ?? "").trim().split(/\s+/).includes(lot));
  if (!match) return { status: "not_found" };
  const longitude = Number(match.x);
  const latitude = Number(match.y);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { status: "not_found" };
  return { status: "ok", latitude, longitude, refinedAddress: match.jibunAddress };
}

/** 네이버 클라우드 Maps Geocoding */
export class NaverGeocoder implements Geocoder {
  readonly provider = "naver";

  constructor(
    private readonly keyId: string,
    private readonly key: string,
  ) {}

  async geocodeParcel(address: string): Promise<GeocodeResult> {
    try {
      const response = await fetch(
        `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?${new URLSearchParams({ query: address, count: "5" })}`,
        {
          headers: { "x-ncp-apigw-api-key-id": this.keyId, "x-ncp-apigw-api-key": this.key, Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) return { status: "error", message: `HTTP ${response.status}` };
      return parseNaverResponse((await response.json()) as NaverGeocodeResponse, address);
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : String(error) };
    }
  }
}

/** 앞 제공자가 실패한 주소만 다음 제공자로 넘긴다. 성공한 제공자 이름을 provider로 남긴다. */
export class FallbackGeocoder implements Geocoder {
  provider: string;

  constructor(private readonly geocoders: Geocoder[]) {
    if (geocoders.length === 0) throw new Error("FallbackGeocoder: no geocoders");
    this.provider = geocoders.map((g) => g.provider).join("+");
  }

  async geocodeWithProvider(address: string): Promise<GeocodeResult & { provider: string }> {
    let last: GeocodeResult & { provider: string } = { status: "error", provider: this.provider };
    let sawError = false;
    for (const geocoder of this.geocoders) {
      const result = await geocoder.geocodeParcel(address);
      if (result.status === "ok") return { ...result, provider: geocoder.provider };
      if (result.status === "error") sawError = true;
      last = { ...result, provider: geocoder.provider };
    }
    // 하나라도 오류였으면 다음 실행에서 다시 시도하도록 error로 남긴다.
    return sawError ? { ...last, status: "error" } : last;
  }

  async geocodeParcel(address: string): Promise<GeocodeResult> {
    return this.geocodeWithProvider(address);
  }
}

/** 환경변수에 키가 있는 제공자만 순서대로 쓴다. 브이월드가 기본, 네이버는 보조. */
export function createGeocoderFromEnv(env: NodeJS.ProcessEnv, options: { vworldIntervalMs?: number } = {}): FallbackGeocoder {
  const geocoders: Geocoder[] = [];
  if (env.VWORLD_API_KEY) geocoders.push(new VworldGeocoder(env.VWORLD_API_KEY, { minIntervalMs: options.vworldIntervalMs }));
  if (env.NAVER_MAP_CLIENT_ID && env.NAVER_MAP_CLIENT_SECRET) {
    geocoders.push(new NaverGeocoder(env.NAVER_MAP_CLIENT_ID, env.NAVER_MAP_CLIENT_SECRET));
  }
  if (geocoders.length === 0) throw new Error("VWORLD_API_KEY 또는 NAVER_MAP_CLIENT_ID/SECRET가 필요합니다");
  return new FallbackGeocoder(geocoders);
}
