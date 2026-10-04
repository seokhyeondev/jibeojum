-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "launch_partner_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "favorited_at" TIMESTAMPTZ(6),
ADD COLUMN     "inquired_at" TIMESTAMPTZ(6),
ADD COLUMN     "viewed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "listing_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "listing_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_reports_status_idx" ON "listing_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "listing_reports_listing_user_uq" ON "listing_reports"("listing_id", "user_id");

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
