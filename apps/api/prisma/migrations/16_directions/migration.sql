-- AlterTable
ALTER TABLE "housing_requests" ADD COLUMN     "directions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "direction" TEXT;
