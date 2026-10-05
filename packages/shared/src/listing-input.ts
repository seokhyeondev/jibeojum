import { z } from "zod";
import { assetUrlSchema } from "./upload";

const requiredOption = z.enum(["station", "elevator", "parking", "pet", "jeonse_loan", "full_option"]);
const safetyOption = z.enum(["women_only", "secure_entrance", "cctv", "window_guard", "main_road", "parcel_locker"]);
/** 받침 유무로 조사를 고른다: 제목을/주소를, 제목은/주소는, 월세가/관리비가 */
const josa = (word: string, withFinal: string, withoutFinal: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : withoutFinal);
};
const 을 = (w: string) => josa(w, "을", "를");
const 은 = (w: string) => josa(w, "은", "는");
const 이 = (w: string) => josa(w, "이", "가");

/** 화면에 그대로 보여줄 수 있게 필드마다 한국어 메시지를 둔다 */
const num = (label: string) => z.number({ required_error: `${을(label)} 입력해주세요`, invalid_type_error: `${을(label)} 숫자로 입력해주세요` });
const int = (label: string) => num(label).int(`${을(label)} 정수로 입력해주세요`);
const manwon = (label: string) => int(label).min(0, `${을(label)} 확인해주세요`).max(1_000_000, `${이(label)} 너무 커요`);
const text = (label: string, min: number, max: number) =>
  z
    .string({ required_error: `${을(label)} 입력해주세요` })
    .trim()
    .min(min, `${을(label)} ${min}자 이상 써주세요`)
    .max(max, `${은(label)} ${max}자까지 쓸 수 있어요`);
const optionalText = (label: string, max: number) => z.string().trim().max(max, `${은(label)} ${max}자까지 쓸 수 있어요`).nullable().default(null);

/** 중개사가 등록하는 매물. 좌표·가까운 역·통근시간은 서버가 주소로 채운다. */
export const agentListingInputSchema = z
  .object({
    title: text("제목", 4, 60),
    housingType: z.enum(["studio", "officetel", "two_room", "apartment"], { errorMap: () => ({ message: "유형을 골라주세요" }) }),
    transactionType: z.enum(["rent", "jeonse"], { errorMap: () => ({ message: "거래 종류를 골라주세요" }) }),
    /** 만원 */
    deposit: manwon("보증금"),
    monthlyRent: manwon("월세"),
    maintenanceFee: manwon("관리비").default(0),
    /** 주소 검색에서 고른 도로명(또는 지번) 주소. 동·호수는 넣지 않는다 */
    address: text("주소", 5, 120),
    /** 주소 검색에서 고른 좌표 (WGS84) */
    latitude: z.number({ required_error: "주소를 검색해서 골라주세요", invalid_type_error: "주소를 검색해서 골라주세요" }).min(33).max(39),
    longitude: z.number({ required_error: "주소를 검색해서 골라주세요", invalid_type_error: "주소를 검색해서 골라주세요" }).min(124).max(132),
    exclusiveAreaM2: num("전용면적").positive("전용면적을 확인해주세요").max(500, "전용면적을 확인해주세요"),
    floor: int("층").min(-5, "층을 확인해주세요").max(120, "층을 확인해주세요"),
    totalFloors: int("건물 층수").min(1, "건물 층수를 확인해주세요").max(120, "건물 층수를 확인해주세요"),
    floorType: z.enum(["normal", "semi_basement", "rooftop"], { errorMap: () => ({ message: "층 구분을 골라주세요" }) }).default("normal"),
    /** 향. 모르면 null */
    direction: z.enum(["south", "east", "west", "north"]).nullable().default(null),
    builtYear: int("준공연도").min(1950, "준공연도를 확인해주세요 (예: 2018)").max(2035, "준공연도를 확인해주세요 (예: 2018)"),
    /** "YYYY-MM-DD", 비우면 즉시 입주 */
    availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "입주 가능일을 확인해주세요").nullable().default(null),
    moveInNote: optionalText("입주 메모", 40),
    options: z.array(requiredOption).max(6).default([]),
    security: z.array(safetyOption).max(6).default([]),
    description: text("설명", 10, 1000),
    /** 업로드한 사진 (CloudFront 주소), 첫 장이 대표 사진 */
    imageUrls: z.array(assetUrlSchema).max(10, "사진은 10장까지예요").default([]),
    agentNote: optionalText("고객에게 한마디", 300),
  })
  .refine((v) => v.transactionType === "jeonse" || v.monthlyRent > 0, { message: "월세 매물은 월세가 필요해요", path: ["monthlyRent"] })
  .refine((v) => v.floor <= v.totalFloors, { message: "층수가 건물 층수보다 높아요", path: ["floor"] });

export type AgentListingInput = z.infer<typeof agentListingInputSchema>;
export type AgentListingDraft = z.input<typeof agentListingInputSchema>;
