-- AlterTable
ALTER TABLE "broker_offices" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "broker_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "zone_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'contacted',
    "note" TEXT,
    "contacted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "request_id" UUID NOT NULL,
    "office_id" UUID,
    "contact_id" UUID,
    "zone_keys" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_agent_id" UUID,
    "accepted_at" TIMESTAMPTZ(6),

    CONSTRAINT "agent_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broker_contacts_office_idx" ON "broker_contacts"("office_id");

-- CreateIndex
CREATE UNIQUE INDEX "broker_contacts_request_office_uq" ON "broker_contacts"("request_id", "office_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_invites_token_hash_uq" ON "agent_invites"("token_hash");

-- CreateIndex
CREATE INDEX "agent_invites_request_idx" ON "agent_invites"("request_id");

-- CreateIndex
CREATE INDEX "broker_offices_coord_idx" ON "broker_offices"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "broker_offices_name_address_uq" ON "broker_offices"("name", "address");

-- AddForeignKey
ALTER TABLE "broker_contacts" ADD CONSTRAINT "broker_contacts_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "housing_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "broker_contacts" ADD CONSTRAINT "broker_contacts_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "broker_offices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent_invites" ADD CONSTRAINT "agent_invites_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "housing_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent_invites" ADD CONSTRAINT "agent_invites_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "broker_offices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent_invites" ADD CONSTRAINT "agent_invites_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "broker_contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent_invites" ADD CONSTRAINT "agent_invites_agent_id_fk" FOREIGN KEY ("accepted_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
