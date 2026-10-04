import { createHash } from "node:crypto";

/** 국토부 전월세 실거래 API 종류 */
export type RentSource = "apt" | "rh" | "sh" | "offi";

export const RENT_SOURCES: Record<RentSource, { path: string; label: string }> = {
  apt: { path: "RTMSDataSvcAptRent/getRTMSDataSvcAptRent", label: "아파트" },
  rh: { path: "RTMSDataSvcRHRent/getRTMSDataSvcRHRent", label: "연립다세대" },
  sh: { path: "RTMSDataSvcSHRent/getRTMSDataSvcSHRent", label: "단독다가구" },
  offi: { path: "RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent", label: "오피스텔" },
};

export type RawRentItem = Record<string, string | number | undefined>;

export interface NormalizedRent {
  dedupeKey: string;
  source: RentSource;
  sggCd: string;
  umdNm: string;
  jibun: string | null;
  buildingName: string | null;
  houseType: string;
  contractDate: string;
  deposit: number;
  monthlyRent: number;
  areaM2: number | null;
  floor: number | null;
  buildYear: number | null;
  contractType: string | null;
  addressKey: string | null;
}

const text = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
};

/** "30,000" → 30000. 비어 있거나 숫자가 아니면 null */
export function toInt(value: unknown): number | null {
  const s = text(value)?.replace(/,/g, "");
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s));
}

export function toFloat(value: unknown): number | null {
  const s = text(value)?.replace(/,/g, "");
  if (!s || Number.isNaN(Number(s))) return null;
  return Number(s);
}

/** 지번이 마스킹("1**")되었거나 비어 있으면 위치로 쓰지 않는다. */
export function usableJibun(jibun: string | null): string | null {
  if (!jibun) return null;
  return /^(산\s?)?\d+(-\d+)?$/.test(jibun) ? jibun : null;
}

export const addressKeyOf = (sggCd: string, umdNm: string, jibun: string) => `${sggCd}|${umdNm}|${jibun}`;

const HOUSE_TYPE_BY_SOURCE: Record<RentSource, string> = { apt: "아파트", rh: "연립다세대", sh: "단독다가구", offi: "오피스텔" };

/**
 * API 원본 항목 하나를 정규화한다. 계약일이나 금액이 없으면 null.
 * dedupeKey는 같은 내용의 행이 여러 개일 때를 위해 occurrence(같은 배치 안의 순번)를 붙인다.
 */
export function normalizeRentItem(
  source: RentSource,
  item: RawRentItem,
  occurrence: (baseKey: string) => number,
): NormalizedRent | null {
  const sggCd = text(item.sggCd);
  const umdNm = text(item.umdNm);
  const year = toInt(item.dealYear);
  const month = toInt(item.dealMonth);
  const day = toInt(item.dealDay);
  const deposit = toInt(item.deposit);
  const monthlyRent = toInt(item.monthlyRent) ?? 0;
  if (!sggCd || !umdNm || !year || !month || !day || deposit === null) return null;

  const contractDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const jibun = usableJibun(text(item.jibun));
  const buildingName = text(item.aptNm) ?? text(item.mhouseNm) ?? text(item.offiNm);
  const areaM2 = toFloat(item.excluUseAr) ?? toFloat(item.totalFloorAr);
  const floor = toInt(item.floor);
  const houseType = text(item.houseType) ?? HOUSE_TYPE_BY_SOURCE[source];

  const base = [source, sggCd, umdNm, jibun ?? "", buildingName ?? "", contractDate, deposit, monthlyRent, areaM2 ?? "", floor ?? "", houseType].join("|");
  const hash = createHash("sha1").update(base).digest("hex");

  return {
    dedupeKey: `${hash}#${occurrence(hash)}`,
    source,
    sggCd,
    umdNm,
    jibun,
    buildingName,
    houseType,
    contractDate,
    deposit,
    monthlyRent,
    areaM2,
    floor,
    buildYear: toInt(item.buildYear),
    contractType: text(item.contractType),
    addressKey: jibun ? addressKeyOf(sggCd, umdNm, jibun) : null,
  };
}

/** 한 번 받은 응답 묶음을 정규화한다. 같은 내용의 행은 순번으로 구분한다. */
export function normalizeRentBatch(source: RentSource, items: RawRentItem[]): NormalizedRent[] {
  const seen = new Map<string, number>();
  const occurrence = (key: string) => {
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n;
  };
  return items.flatMap((item) => normalizeRentItem(source, item, occurrence) ?? []);
}
