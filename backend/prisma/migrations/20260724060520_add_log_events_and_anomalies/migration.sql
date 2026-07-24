-- CreateTable
CREATE TABLE "LogEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "host" TEXT,
    "service" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "zscore" DOUBLE PRECISION NOT NULL,
    "observed" DOUBLE PRECISION NOT NULL,
    "expected" DOUBLE PRECISION NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "context" JSONB NOT NULL DEFAULT '{}',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogEvent_tenantId_source_timestamp_idx" ON "LogEvent"("tenantId", "source", "timestamp");

-- CreateIndex
CREATE INDEX "LogEvent_tenantId_level_timestamp_idx" ON "LogEvent"("tenantId", "level", "timestamp");

-- CreateIndex
CREATE INDEX "Anomaly_tenantId_detectedAt_idx" ON "Anomaly"("tenantId", "detectedAt");

-- CreateIndex
CREATE INDEX "Anomaly_tenantId_status_idx" ON "Anomaly"("tenantId", "status");
