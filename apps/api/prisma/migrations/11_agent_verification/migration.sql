-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "license_image_key" TEXT,
ADD COLUMN     "registration_no" TEXT,
ADD COLUMN     "reject_reason" TEXT,
ADD COLUMN     "verification_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "verified_at" TIMESTAMPTZ(6);

-- 이미 있는 계정(운영자가 만들었거나 테스트 중인 계정)은 승인된 것으로 둔다
UPDATE "agents" SET "verification_status" = 'verified', "verified_at" = now() WHERE "login_id" IS NOT NULL;
