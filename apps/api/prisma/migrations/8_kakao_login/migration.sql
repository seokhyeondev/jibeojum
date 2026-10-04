-- AlterTable
ALTER TABLE "users" ADD COLUMN     "kakao_id" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "profile_image_url" TEXT,
ALTER COLUMN "session_token_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_unique" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_kakao_id_unique" ON "users"("kakao_id");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- 기존 브라우저 세션을 새 세션 테이블로 옮긴다
INSERT INTO "user_sessions" ("user_id", "token_hash", "created_at")
SELECT "id", "session_token_hash", "created_at" FROM "users" WHERE "session_token_hash" IS NOT NULL;
