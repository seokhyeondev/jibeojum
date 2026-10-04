import { z } from "zod";
import type { BrokerContactStatus } from "./types/operations";

export const BROKER_CONTACT_LABEL: Record<BrokerContactStatus, string> = {
  contacted: "연락함",
  no_answer: "부재",
  interested: "찾아보는 중",
  no_listing: "매물 없음",
  declined: "거절",
  joined: "가입함",
  has_listing: "매물 등록",
};

/** 운영자가 고르는 상태 (joined·has_listing은 자동) */
export const MANUAL_CONTACT_STATUSES = ["contacted", "no_answer", "interested", "no_listing", "declined"] as const;

const status = z.enum(MANUAL_CONTACT_STATUSES, { errorMap: () => ({ message: "연락 상태를 골라주세요" }) });
const note = z.string().trim().max(500, "메모는 500자까지예요").nullable().default(null);
const phone = z
  .string()
  .trim()
  .max(30, "전화번호를 확인해주세요")
  .nullable()
  .default(null)
  .transform((v) => v || null);

/** 연락 기록 남기기. 우리 목록에 있는 곳은 officeId, 처음 보는 곳은 office(네이버 검색 결과) */
export const brokerContactCreateSchema = z
  .object({
    zoneKey: z.string().max(120).nullable().default(null),
    officeId: z.string().uuid().nullable().default(null),
    office: z
      .object({
        name: z.string().trim().min(1, "부동산 이름이 필요해요").max(80),
        address: z.string().trim().min(2, "주소가 필요해요").max(160),
        phone,
        link: z.string().url().max(500).nullable().default(null),
        latitude: z.number().min(33).max(39).nullable().default(null),
        longitude: z.number().min(124).max(132).nullable().default(null),
      })
      .nullable()
      .default(null),
    status: status.default("contacted"),
    note,
  })
  .refine((v) => v.officeId || v.office, { message: "부동산을 골라주세요", path: ["office"] });

export const brokerContactUpdateSchema = z.object({
  status: status.optional(),
  note: note.optional(),
  /** 사무소 전화번호 (네이버에 없을 때 운영자가 적는다) */
  phone: phone.optional(),
});

export type BrokerContactCreateInput = z.infer<typeof brokerContactCreateSchema>;
export type BrokerContactUpdateInput = z.infer<typeof brokerContactUpdateSchema>;
