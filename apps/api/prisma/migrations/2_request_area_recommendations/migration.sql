-- CreateTable
CREATE TABLE "request_area_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "destination_query" TEXT NOT NULL,
    "destination" JSONB,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_area_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_area_recommendations_request_id_key" ON "request_area_recommendations"("request_id");

-- CreateIndex
CREATE INDEX "request_area_recommendations_status_idx" ON "request_area_recommendations"("status");

-- AddForeignKey
ALTER TABLE "request_area_recommendations" ADD CONSTRAINT "request_area_recommendations_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "housing_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
