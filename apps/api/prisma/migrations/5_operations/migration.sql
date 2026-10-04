-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "access_issued_at" TIMESTAMPTZ(6),
ADD COLUMN     "access_token_hash" TEXT;

-- CreateTable
CREATE TABLE "request_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "zone_keys" TEXT[],
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_assignments_agent_idx" ON "request_assignments"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_assignments_request_agent_uq" ON "request_assignments"("request_id", "agent_id");

-- CreateIndex
CREATE INDEX "notifications_user_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agents_access_token_hash_key" ON "agents"("access_token_hash");

-- AddForeignKey
ALTER TABLE "request_assignments" ADD CONSTRAINT "request_assignments_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "housing_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "request_assignments" ADD CONSTRAINT "request_assignments_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
