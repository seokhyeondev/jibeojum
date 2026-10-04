import type { UploadPurpose } from "@zipazum/shared";
import { requestUpload } from "./api/client";
import { resizeImage } from "./image";

const SIZE: Record<UploadPurpose, { size: number; square: boolean }> = {
  "agent-photo": { size: 320, square: true },
  "listing-photo": { size: 1600, square: false },
};

/** 사진을 줄여 S3에 직접 올리고 CloudFront 주소를 돌려준다 */
export async function uploadPhoto(file: File, purpose: UploadPurpose): Promise<string> {
  const blob = await resizeImage(file, SIZE[purpose]);
  const ticket = await requestUpload({ purpose, contentType: "image/jpeg", size: blob.size });
  const response = await fetch(ticket.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
  if (!response.ok) throw new Error("사진을 올리지 못했어요. 다시 시도해주세요");
  return ticket.url;
}
