-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "source_count" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anchor_admin_areas" (
    "grid_id" TEXT NOT NULL,
    "adm_code" TEXT,
    "adm_name" TEXT,
    "sido" TEXT,
    "sigungu" TEXT,
    "provider" TEXT NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anchor_admin_areas_pkey" PRIMARY KEY ("grid_id")
);

-- CreateTable
CREATE TABLE "commute_zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "zone_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "station_id" TEXT,
    "station_name" TEXT,
    "adm_code" TEXT,
    "adm_name" TEXT,
    "sido" TEXT NOT NULL,
    "sigungu" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "rep_grid_id" TEXT NOT NULL,
    "station_walk_minutes" INTEGER,
    "anchor_count" INTEGER NOT NULL,
    "building_count" INTEGER NOT NULL,
    "transaction_count" INTEGER NOT NULL,
    "residential_score" DOUBLE PRECISION NOT NULL,
    "stats_by_type" JSONB NOT NULL,
    "source_from" DATE NOT NULL,
    "source_to" DATE NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commute_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anchor_zone_assignments" (
    "grid_id" TEXT NOT NULL,
    "zone_key" TEXT NOT NULL,
    "station_id" TEXT,
    "station_distance_m" INTEGER,

    CONSTRAINT "anchor_zone_assignments_pkey" PRIMARY KEY ("grid_id")
);

-- CreateIndex
CREATE INDEX "stations_lat_lng_idx" ON "stations"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "commute_zones_zone_key_key" ON "commute_zones"("zone_key");

-- CreateIndex
CREATE INDEX "commute_zones_lat_lng_idx" ON "commute_zones"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "anchor_zone_assignments_zone_idx" ON "anchor_zone_assignments"("zone_key");
