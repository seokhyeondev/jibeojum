-- CreateTable
CREATE TABLE "rent_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dedupe_key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sgg_cd" TEXT NOT NULL,
    "umd_nm" TEXT NOT NULL,
    "jibun" TEXT,
    "building_name" TEXT,
    "house_type" TEXT NOT NULL,
    "contract_date" DATE NOT NULL,
    "deposit" INTEGER NOT NULL,
    "monthly_rent" INTEGER NOT NULL,
    "area_m2" DOUBLE PRECISION,
    "floor" INTEGER,
    "build_year" INTEGER,
    "contract_type" TEXT,
    "address_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocoded_addresses" (
    "address_key" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "refined_address" TEXT,
    "provider" TEXT NOT NULL,
    "geocoded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocoded_addresses_pkey" PRIMARY KEY ("address_key")
);

-- CreateTable
CREATE TABLE "residential_anchors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grid_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "sido" TEXT NOT NULL,
    "sigungu" TEXT NOT NULL,
    "legal_dong" TEXT NOT NULL,
    "sgg_cd" TEXT NOT NULL,
    "building_count" INTEGER NOT NULL,
    "transaction_count" INTEGER NOT NULL,
    "officetel_count" INTEGER NOT NULL,
    "multifamily_count" INTEGER NOT NULL,
    "apartment_count" INTEGER NOT NULL,
    "dong_detached_count" INTEGER NOT NULL,
    "monthly_deposit_median" INTEGER,
    "monthly_rent_median" INTEGER,
    "jeonse_deposit_median" INTEGER,
    "small_unit_share" DOUBLE PRECISION NOT NULL,
    "residential_score" DOUBLE PRECISION NOT NULL,
    "latest_contract_date" DATE NOT NULL,
    "source_from" DATE NOT NULL,
    "source_to" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "residential_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_dong_rent_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sgg_cd" TEXT NOT NULL,
    "umd_nm" TEXT NOT NULL,
    "sigungu" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "transaction_count" INTEGER NOT NULL,
    "monthly_deposit_median" INTEGER,
    "monthly_rent_median" INTEGER,
    "jeonse_deposit_median" INTEGER,
    "source_from" DATE NOT NULL,
    "source_to" DATE NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_dong_rent_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transit_route_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cache_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "origin_grid_id" TEXT,
    "origin_lat" DOUBLE PRECISION NOT NULL,
    "origin_lng" DOUBLE PRECISION NOT NULL,
    "dest_lat" DOUBLE PRECISION NOT NULL,
    "dest_lng" DOUBLE PRECISION NOT NULL,
    "time_slot" TEXT NOT NULL,
    "data_date" TEXT NOT NULL,
    "best_minutes" INTEGER,
    "best_transfer_count" INTEGER,
    "no_transfer_minutes" INTEGER,
    "result" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transit_route_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rent_transactions_dedupe_key_key" ON "rent_transactions"("dedupe_key");

-- CreateIndex
CREATE INDEX "rent_transactions_sgg_date_idx" ON "rent_transactions"("sgg_cd", "contract_date");

-- CreateIndex
CREATE INDEX "rent_transactions_address_idx" ON "rent_transactions"("address_key");

-- CreateIndex
CREATE UNIQUE INDEX "residential_anchors_grid_id_key" ON "residential_anchors"("grid_id");

-- CreateIndex
CREATE INDEX "residential_anchors_lat_lng_idx" ON "residential_anchors"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "residential_anchors_dong_idx" ON "residential_anchors"("sgg_cd", "legal_dong");

-- CreateIndex
CREATE UNIQUE INDEX "legal_dong_rent_stats_uq" ON "legal_dong_rent_stats"("sgg_cd", "umd_nm", "source");

-- CreateIndex
CREATE UNIQUE INDEX "transit_route_cache_cache_key_key" ON "transit_route_cache"("cache_key");

-- CreateIndex
CREATE INDEX "transit_route_cache_origin_idx" ON "transit_route_cache"("origin_grid_id");
