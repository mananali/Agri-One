CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

ALTER TABLE "Organization"
  ADD COLUMN "panEncrypted" TEXT,
  ADD COLUMN "bankAccountNameEncrypted" TEXT,
  ADD COLUMN "bankAccountNumberEncrypted" TEXT,
  ADD COLUMN "bankIfscEncrypted" TEXT;

CREATE TABLE "RetailerStock" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetailerStock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subject" VARCHAR(160) NOT NULL,
  "message" VARCHAR(3000) NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "adminReply" VARCHAR(3000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetailerStock_organizationId_productId_key" ON "RetailerStock"("organizationId", "productId");
CREATE INDEX "RetailerStock_organizationId_quantity_lowStockThreshold_idx" ON "RetailerStock"("organizationId", "quantity", "lowStockThreshold");
CREATE INDEX "SupportTicket_organizationId_createdAt_idx" ON "SupportTicket"("organizationId", "createdAt");
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

ALTER TABLE "RetailerStock" ADD CONSTRAINT "RetailerStock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetailerStock" ADD CONSTRAINT "RetailerStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
