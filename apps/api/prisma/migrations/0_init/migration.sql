-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "zipazum";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_token_hash" TEXT NOT NULL,
    "phone_hash" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_offices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "registration_no" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "office_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housing_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "client_key" TEXT NOT NULL,
    "destination_label" TEXT NOT NULL,
    "max_commute_minutes" INTEGER NOT NULL,
    "no_transfer_extra_minutes" INTEGER NOT NULL DEFAULT 0,
    "transaction_preference" TEXT NOT NULL DEFAULT 'rent',
    "deposit_max" INTEGER,
    "monthly_rent_max" INTEGER,
    "jeonse_max" INTEGER,
    "budget_flexibility" TEXT NOT NULL,
    "housing_types" TEXT[],
    "move_in_date" DATE NOT NULL,
    "move_in_flexibility" TEXT NOT NULL,
    "required_options" TEXT[],
    "floor_preference" TEXT NOT NULL DEFAULT 'any',
    "floor_exclusions" TEXT[],
    "building_age" TEXT NOT NULL DEFAULT 'any',
    "safety_options" TEXT[],
    "infrastructure" TEXT[],
    "verification_status" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'matching',
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "housing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "housing_type" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "deposit" INTEGER NOT NULL,
    "monthly_rent" INTEGER NOT NULL,
    "maintenance_fee" INTEGER NOT NULL DEFAULT 0,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "station_name" TEXT NOT NULL,
    "station_walk_minutes" INTEGER NOT NULL,
    "exclusive_area_m2" DOUBLE PRECISION NOT NULL,
    "floor" INTEGER NOT NULL,
    "total_floors" INTEGER NOT NULL,
    "floor_type" TEXT NOT NULL DEFAULT 'normal',
    "built_year" INTEGER NOT NULL,
    "available_from" DATE,
    "move_in_note" TEXT,
    "options" TEXT[],
    "security" TEXT[],
    "nearby" JSONB NOT NULL,
    "tags" TEXT[],
    "description" TEXT NOT NULL,
    "images" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "commute" JSONB NOT NULL,
    "rank" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "agent_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_session_token_hash_unique" ON "users"("session_token_hash");

-- CreateIndex
CREATE INDEX "agents_office_idx" ON "agents"("office_id");

-- CreateIndex
CREATE INDEX "housing_requests_user_idx" ON "housing_requests"("user_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "housing_requests_user_client_key_uq" ON "housing_requests"("user_id", "client_key");

-- CreateIndex
CREATE INDEX "listings_agent_idx" ON "listings"("agent_id");

-- CreateIndex
CREATE INDEX "proposals_request_idx" ON "proposals"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_request_listing_uq" ON "proposals"("request_id", "listing_id");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_office_id_broker_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "broker_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "housing_requests" ADD CONSTRAINT "housing_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_request_id_housing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "housing_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
