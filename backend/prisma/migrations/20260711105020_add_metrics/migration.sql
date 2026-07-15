-- CreateTable
CREATE TABLE "Metric" (
    "id" SERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Metric_tenantId_source_metricName_recordedAt_idx" ON "Metric"("tenantId", "source", "metricName", "recordedAt");
