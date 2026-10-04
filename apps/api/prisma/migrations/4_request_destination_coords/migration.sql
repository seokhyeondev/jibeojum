-- AlterTable
ALTER TABLE "housing_requests" ADD COLUMN     "destination_address" TEXT,
ADD COLUMN     "destination_latitude" DOUBLE PRECISION,
ADD COLUMN     "destination_longitude" DOUBLE PRECISION;
