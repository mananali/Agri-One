ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'PURCHASING';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'ACTIVITY';

CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "CashAccountType" AS ENUM ('CASH', 'BANK');
CREATE TYPE "FinancialTransactionType" AS ENUM ('OPENING_BALANCE', 'RETAILER_RECEIPT', 'SUPPLIER_PAYMENT', 'BUSINESS_EXPENSE', 'SALE', 'PURCHASE', 'REFUND', 'ADJUSTMENT');

CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "supplierOrganizationId" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "total" DECIMAL(12,2) NOT NULL,
  "note" VARCHAR(1000),
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderLine" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashBankAccount" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "type" "CashAccountType" NOT NULL,
  "bankName" VARCHAR(120),
  "accountNumberLast4" VARCHAR(4),
  "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseReceipt" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "receivedById" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseReceiptLine" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "PurchaseReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialTransaction" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "type" "FinancialTransactionType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "accountId" TEXT NOT NULL,
  "partyOrganizationId" TEXT,
  "customerOrderId" TEXT,
  "purchaseOrderId" TEXT,
  "category" VARCHAR(100),
  "reference" VARCHAR(120),
  "note" VARCHAR(1000),
  "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ErrorLog" (
  "id" TEXT NOT NULL,
  "requestId" VARCHAR(80) NOT NULL,
  "method" VARCHAR(10) NOT NULL,
  "path" VARCHAR(300) NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "errorType" VARCHAR(120) NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DatabaseBackup" (
  "id" TEXT NOT NULL,
  "fileName" VARCHAR(180) NOT NULL,
  "storagePath" VARCHAR(500) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "sizeBytes" BIGINT,
  "errorCode" VARCHAR(120),
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "DatabaseBackup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");
CREATE INDEX "PurchaseOrder_supplierOrganizationId_status_createdAt_idx" ON "PurchaseOrder"("supplierOrganizationId", "status", "createdAt");
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");
CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_productId_key" ON "PurchaseOrderLine"("purchaseOrderId", "productId");
CREATE INDEX "PurchaseOrderLine_productId_createdAt_idx" ON "PurchaseOrderLine"("productId", "createdAt");
CREATE UNIQUE INDEX "PurchaseReceipt_idempotencyKey_key" ON "PurchaseReceipt"("idempotencyKey");
CREATE INDEX "PurchaseReceipt_purchaseOrderId_receivedAt_idx" ON "PurchaseReceipt"("purchaseOrderId", "receivedAt");
CREATE UNIQUE INDEX "PurchaseReceiptLine_receiptId_purchaseOrderLineId_key" ON "PurchaseReceiptLine"("receiptId", "purchaseOrderLineId");
CREATE INDEX "PurchaseReceiptLine_purchaseOrderLineId_idx" ON "PurchaseReceiptLine"("purchaseOrderLineId");
CREATE INDEX "CashBankAccount_isActive_type_idx" ON "CashBankAccount"("isActive", "type");
CREATE UNIQUE INDEX "FinancialTransaction_idempotencyKey_key" ON "FinancialTransaction"("idempotencyKey");
CREATE INDEX "FinancialTransaction_type_transactionDate_idx" ON "FinancialTransaction"("type", "transactionDate");
CREATE INDEX "FinancialTransaction_partyOrganizationId_transactionDate_idx" ON "FinancialTransaction"("partyOrganizationId", "transactionDate");
CREATE INDEX "FinancialTransaction_customerOrderId_transactionDate_idx" ON "FinancialTransaction"("customerOrderId", "transactionDate");
CREATE INDEX "FinancialTransaction_purchaseOrderId_transactionDate_idx" ON "FinancialTransaction"("purchaseOrderId", "transactionDate");
CREATE INDEX "FinancialTransaction_accountId_transactionDate_idx" ON "FinancialTransaction"("accountId", "transactionDate");
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
CREATE INDEX "ErrorLog_statusCode_createdAt_idx" ON "ErrorLog"("statusCode", "createdAt");
CREATE INDEX "DatabaseBackup_createdAt_idx" ON "DatabaseBackup"("createdAt");
CREATE INDEX "DatabaseBackup_status_createdAt_idx" ON "DatabaseBackup"("status", "createdAt");

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CashBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_partyOrganizationId_fkey" FOREIGN KEY ("partyOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DatabaseBackup" ADD CONSTRAINT "DatabaseBackup_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
