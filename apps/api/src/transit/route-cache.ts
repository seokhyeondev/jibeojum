/** 도착 좌표는 소수 셋째 자리(약 100m)로 반올림해 같은 출근지를 묶는다 */
export const roundCoord = (value: number, digits = 3) => Number(value.toFixed(digits));

export interface RouteCacheKeyInput {
  provider: string;
  /** 출발 지점 키 (station:<역>, zone:<생활권>, H3 셀 등). 없으면 반올림한 출발 좌표를 쓴다 */
  originKey?: string | null;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  timeSlot: string;
  dataDate: string;
}

export function routeCacheKey(input: RouteCacheKeyInput): string {
  const origin = input.originKey ?? `${roundCoord(input.originLat)},${roundCoord(input.originLng)}`;
  return [input.provider, origin, `${roundCoord(input.destLat)},${roundCoord(input.destLng)}`, input.timeSlot, input.dataDate].join("|");
}

/**
 * 출근 시간대 이름 → TMAP searchDttm.
 * "weekday-0800"이면 기준일 이후 가장 가까운 평일 08:00(한국 시간)이다.
 */
export function searchDateTimeFor(timeSlot: string, now = new Date()): string {
  const match = /^weekday-(\d{2})(\d{2})$/.exec(timeSlot);
  if (!match) throw new Error(`unknown time slot: ${timeSlot}`);
  // 한국 시간 기준 날짜로 계산한다
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const day = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
  const ymd = day.toISOString().slice(0, 10).replace(/-/g, "");
  return `${ymd}${match[1]}${match[2]}`;
}
