-- AlterTable
ALTER TABLE "users" ADD COLUMN     "apple_refresh_token" TEXT,
ADD COLUMN     "apple_sub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_apple_sub_unique" ON "users"("apple_sub");
