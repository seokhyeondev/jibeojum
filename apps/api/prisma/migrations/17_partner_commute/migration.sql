-- AlterTable
ALTER TABLE "housing_requests" ADD COLUMN     "partner_destination_address" TEXT,
ADD COLUMN     "partner_destination_label" TEXT,
ADD COLUMN     "partner_destination_latitude" DOUBLE PRECISION,
ADD COLUMN     "partner_destination_longitude" DOUBLE PRECISION,
ADD COLUMN     "partner_max_commute_minutes" INTEGER;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "partner_commute" JSONB;
