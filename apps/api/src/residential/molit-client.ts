import { XMLParser } from "fast-xml-parser";
import { RENT_SOURCES, type RawRentItem, type RentSource } from "./rent-normalize.js";

const BASE_URL = "https://apis.data.go.kr/1613000";
const PAGE_SIZE = 1000;

const parser = new XMLParser({ parseTagValue: false, trimValues: true });

export class MolitApiError extends Error {}

interface ParsedPage {
  items: RawRentItem[];
  totalCount: number;
}

/** 응답 XML을 항목 배열로 바꾼다. 오류 응답이면 예외. */
export function parseRentXml(xml: string): ParsedPage {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const gatewayError = (doc.OpenAPI_ServiceResponse as { cmmMsgHeader?: { returnAuthMsg?: string } } | undefined)?.cmmMsgHeader;
  if (gatewayError) throw new MolitApiError(`data.go.kr: ${gatewayError.returnAuthMsg ?? "gateway error"}`);

  const response = doc.response as
    | { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: RawRentItem | RawRentItem[] } | ""; totalCount?: string } }
    | undefined;
  const code = response?.header?.resultCode;
  if (!response || (code !== "000" && code !== "00")) {
    throw new MolitApiError(`molit: ${code ?? "?"} ${response?.header?.resultMsg ?? "unexpected response"}`);
  }
  const raw = response.body?.items && typeof response.body.items === "object" ? response.body.items.item : undefined;
  const items = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return { items, totalCount: Number(response.body?.totalCount ?? items.length) };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MolitRentClient {
  constructor(
    private readonly serviceKey: string,
    private readonly options: { retries?: number; delayMs?: number } = {},
  ) {}

  /** 시군구·계약월 하나의 거래를 모든 페이지에 걸쳐 가져온다. */
  async fetchMonth(source: RentSource, lawdCd: string, dealYmd: string): Promise<RawRentItem[]> {
    const all: RawRentItem[] = [];
    for (let page = 1; ; page++) {
      const { items, totalCount } = await this.fetchPage(source, lawdCd, dealYmd, page);
      all.push(...items);
      if (items.length === 0 || all.length >= totalCount) return all;
    }
  }

  private async fetchPage(source: RentSource, lawdCd: string, dealYmd: string, pageNo: number): Promise<ParsedPage> {
    const url =
      `${BASE_URL}/${RENT_SOURCES[source].path}?serviceKey=${encodeURIComponent(this.serviceKey)}` +
      `&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&pageNo=${pageNo}&numOfRows=${PAGE_SIZE}`;
    const retries = this.options.retries ?? 3;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new MolitApiError(`HTTP ${response.status}`);
        const page = parseRentXml(await response.text());
        if (this.options.delayMs) await sleep(this.options.delayMs);
        return page;
      } catch (error) {
        if (attempt >= retries) throw error;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }
}
