import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MolitApiError, parseRentXml } from "../src/residential/molit-client.js";
import { normalizeRentBatch, toInt, usableJibun } from "../src/residential/rent-normalize.js";

const sampleXml = readFileSync(new URL("./fixtures/rh-rent-sample.xml", import.meta.url), "utf8");

describe("국토부 응답 파싱", () => {
  it("항목과 전체 건수를 읽는다", () => {
    const page = parseRentXml(sampleXml);
    expect(page.totalCount).toBe(3);
    expect(page.items).toHaveLength(3);
    expect(page.items[0].mhouseNm).toBe("신사타운빌");
  });

  it("항목이 하나면 배열로 감싼다", () => {
    const single = sampleXml.replace(/<item>.*<\/item>/s, "<item><dealYear>2026</dealYear></item>");
    expect(parseRentXml(single).items).toHaveLength(1);
  });

  it("인증 오류와 결과 코드 오류는 예외로 던진다", () => {
    expect(() =>
      parseRentXml("<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>"),
    ).toThrow(MolitApiError);
    expect(() => parseRentXml("<response><header><resultCode>03</resultCode><resultMsg>NO DATA</resultMsg></header></response>")).toThrow(/03/);
  });
});

describe("실거래 정규화", () => {
  it("콤마 금액과 날짜를 바꾸고 주소 키를 만든다", () => {
    const [row] = normalizeRentBatch("rh", parseRentXml(sampleXml).items);
    expect(row).toMatchObject({
      source: "rh",
      sggCd: "11620",
      umdNm: "신림동",
      jibun: "1465-1",
      deposit: 30000,
      monthlyRent: 15,
      areaM2: 41.01,
      contractDate: "2026-08-21",
      addressKey: "11620|신림동|1465-1",
    });
  });

  it("완전히 같은 거래가 두 번 있으면 순번으로 구분하고, 다시 받아도 같은 키가 나온다", () => {
    const items = parseRentXml(sampleXml).items;
    const first = normalizeRentBatch("rh", items).map((r) => r.dedupeKey);
    const again = normalizeRentBatch("rh", items).map((r) => r.dedupeKey);
    expect(new Set(first).size).toBe(3);
    expect(first[0]).not.toBe(first[2]);
    expect(again).toEqual(first);
  });

  it("단독다가구처럼 지번이 없거나 가려진 거래는 주소 키를 만들지 않는다", () => {
    const [row] = normalizeRentBatch("sh", [{ sggCd: "11620", umdNm: "봉천동", dealYear: "2026", dealMonth: "8", dealDay: "29", deposit: "1,000", monthlyRent: "60", totalFloorAr: "15", houseType: "단독" }]);
    expect(row.addressKey).toBeNull();
    expect(row.areaM2).toBe(15);
    expect(usableJibun("1**")).toBeNull();
    expect(usableJibun("산 12-3")).toBe("산 12-3");
  });

  it("계약일이나 보증금이 없으면 버린다", () => {
    expect(normalizeRentBatch("offi", [{ sggCd: "11620", umdNm: "봉천동", dealYear: "2026" }])).toHaveLength(0);
    expect(toInt(" ")).toBeNull();
  });
});
