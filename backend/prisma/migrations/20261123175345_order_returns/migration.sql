-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "OrderReturnRequest" (
    "id" TEXT NOT NULL,
    "customerOrderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "reviewReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderReturnRequest_customerOrderId_requestedAt_idx" ON "OrderReturnRequest"("customerOrderId", "requestedAt");

-- CreateIndex
CREATE INDEX "OrderReturnRequest_status_requestedAt_idx" ON "OrderReturnRequest"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "OrderReturnRequest" ADD CONSTRAINT "OrderReturnRequest_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
