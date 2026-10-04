export interface AdminArea {
  admCode: string | null;
  admName: string | null;
  sido: string | null;
  sigungu: string | null;
}

interface NaverReverseResponse {
  status?: { code?: number; name?: string };
  results?: { name?: string; code?: { id?: string }; region?: Record<string, { name?: string }> }[];
}

/** 네이버 역지오코딩(admcode) 응답 → 행정동. 바다·결과 없음이면 이름이 모두 null */
export function parseNaverAdmin(body: NaverReverseResponse): AdminArea {
  const result = body.results?.find((r) => r.name === "admcode");
  if (!result) return { admCode: null, admName: null, sido: null, sigungu: null };
  return {
    admCode: result.code?.id ?? null,
    admName: result.region?.area3?.name || null,
    sido: result.region?.area1?.name || null,
    sigungu: result.region?.area2?.name || null,
  };
}

/** 좌표 → 행정동 (네이버 Maps 역지오코딩) */
export async function reverseGeocodeAdmin(keyId: string, key: string, latitude: number, longitude: number): Promise<AdminArea> {
  const params = new URLSearchParams({ coords: `${longitude},${latitude}`, orders: "admcode", output: "json" });
  const response = await fetch(`https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?${params}`, {
    headers: { "x-ncp-apigw-api-key-id": keyId, "x-ncp-apigw-api-key": key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`naver reverse geocode: HTTP ${response.status}`);
  return parseNaverAdmin((await response.json()) as NaverReverseResponse);
}
