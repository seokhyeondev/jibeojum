import { z } from "zod";
import type { ListingReportReason } from "./types/operations";

export const LISTING_REPORT_LABEL: Record<ListingReportReason, string> = {
  gone: "이미 거래된 매물이에요",
  wrong_info: "정보가 실제와 달라요",
  fake: "없는 매물 같아요",
};

/** 확인된 신고가 이만큼 쌓이면 공인중개사 정지를 검토한다 */
export const REPORT_SUSPEND_THRESHOLD = 3;

export const listingReportSchema = z.object({
  reason: z.enum(["gone", "wrong_info", "fake"], { errorMap: () => ({ message: "신고 이유를 골라주세요" }) }),
  note: z.string().trim().max(300, "300자까지 쓸 수 있어요").nullable().default(null),
});

export const listingReactionSchema = z.object({ type: z.enum(["favorite", "inquire"]) });

export type ListingReportInput = z.infer<typeof listingReportSchema>;
export type ListingReaction = z.infer<typeof listingReactionSchema>["type"];
