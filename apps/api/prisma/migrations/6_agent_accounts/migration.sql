-- DropIndex
DROP INDEX "agents_access_token_hash_key";

-- AlterTable
ALTER TABLE "agents" DROP COLUMN "access_issued_at",
DROP COLUMN "access_token_hash",
ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'seed',
ADD COLUMN     "login_id" TEXT,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "photo_url" TEXT,
ALTER COLUMN "office_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "agents_login_id_key" ON "agents"("login_id");
