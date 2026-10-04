import { z } from "zod";

// 사진 업로드: 웹이 API에서 서명된 S3 주소를 받아 직접 올리고, CloudFront 주소를 저장한다

export const UPLOAD_PURPOSES = ["listing-photo", "agent-photo"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const UPLOAD_MAX_BYTES: Record<UploadPurpose, number> = {
  "listing-photo": 5 * 1024 * 1024,
  "agent-photo": 1024 * 1024,
};

export const uploadRequestSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"], { errorMap: () => ({ message: "JPG·PNG·WEBP 사진만 올릴 수 있어요" }) }),
    size: z.number().int().positive(),
  })
  .refine((v) => v.size <= UPLOAD_MAX_BYTES[v.purpose], { message: "사진 용량이 너무 커요", path: ["size"] });

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export interface UploadTicket {
  /** 이 주소로 PUT (Content-Type 헤더를 그대로 보낸다) */
  uploadUrl: string;
  /** 올린 뒤 저장·표시에 쓰는 CloudFront 주소 */
  url: string;
}

/** 우리 저장소에 올린 사진 주소. 서버가 경로(소유자)까지 다시 확인한다 */
export const assetUrlSchema = z.string().max(500).url("사진을 다시 올려주세요").startsWith("https://", "사진을 다시 올려주세요");
