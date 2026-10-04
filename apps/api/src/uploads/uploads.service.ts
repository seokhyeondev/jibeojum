import { Injectable } from "@nestjs/common";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { UploadRequest, UploadTicket } from "@zipazum/shared";
import { randomUUID } from "node:crypto";
import { ApiException } from "../common/api-exception.js";

const EXT: Record<UploadRequest["contentType"], string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** 업로드 경로. 매물 사진은 공인중개사별로 나눠 다른 사람 사진을 못 쓰게 한다 */
export const uploadPrefix = (purpose: UploadRequest["purpose"], agentId: string | null) =>
  purpose === "listing-photo" ? `listings/${agentId}/` : purpose === "agent-license" ? "private/licenses/" : "agents/";

/** 비공개 업로드는 CloudFront로 읽을 수 없는 경로에 둔다 (버킷 정책이 listings/·agents/만 연다) */
const isPrivate = (purpose: UploadRequest["purpose"]) => purpose === "agent-license";

/**
 * S3에 직접 올릴 서명 주소를 만든다 (5분 유효). 버킷은 비공개이고 CloudFront로만 읽는다.
 * 로컬에서는 AWS_PROFILE 자격 증명을 쓴다.
 */
@Injectable()
export class UploadsService {
  private client: S3Client | null = null;

  private config() {
    const bucket = process.env.S3_BUCKET;
    const base = process.env.ASSET_BASE_URL?.replace(/\/$/, "");
    if (!bucket || !base) throw new ApiException(500, "server_error", "사진 저장소가 설정되지 않았어요.");
    return { bucket, base, region: process.env.S3_REGION ?? "ap-northeast-2" };
  }

  async presign(input: UploadRequest, agentId: string | null): Promise<UploadTicket> {
    const { bucket, base, region } = this.config();
    this.client ??= new S3Client({ region });
    const key = `${uploadPrefix(input.purpose, agentId)}${randomUUID()}.${EXT[input.contentType]}`;
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.size,
        CacheControl: isPrivate(input.purpose) ? "private, no-store" : "public, max-age=31536000, immutable",
      }),
      { expiresIn: 300, signableHeaders: new Set(["content-type", "content-length"]) },
    );
    return { uploadUrl, url: isPrivate(input.purpose) ? null : `${base}/${key}`, key };
  }

  /** 비공개 파일(등록증)을 운영자가 잠깐 볼 수 있는 주소 (5분) */
  async privateUrl(key: string): Promise<string> {
    const { bucket, region } = this.config();
    this.client ??= new S3Client({ region });
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  }

  /** 우리 CloudFront 주소이고 정해진 경로 아래인지 */
  isOwnAsset(url: string, prefix: string): boolean {
    const base = process.env.ASSET_BASE_URL?.replace(/\/$/, "");
    return Boolean(base) && url.startsWith(`${base}/${prefix}`) && !url.includes("..");
  }

  assertOwnAssets(urls: (string | null)[], prefix: string) {
    if (urls.some((u) => u !== null && !this.isOwnAsset(u, prefix))) throw new ApiException(400, "invalid_input", "사진을 다시 올려주세요.");
  }
}
