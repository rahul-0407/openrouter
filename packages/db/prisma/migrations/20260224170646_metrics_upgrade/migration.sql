-- AlterTable
ALTER TABLE "UsageMetric" ADD COLUMN     "firstTokenLatencyMs" INTEGER;

-- CreateIndex
CREATE INDEX "UsageMetric_createdAt_idx" ON "UsageMetric"("createdAt");
