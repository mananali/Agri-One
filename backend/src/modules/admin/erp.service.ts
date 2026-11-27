import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, AdminPermission, CashAccountType, FinancialTransactionType, FulfillmentSource, InventoryMovementType, OrderStatus, OrganizationType, PaymentStatus, Prisma, PurchaseOrderStatus, UserRole, VerificationStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminActivityQueryDto, BusinessExpenseDto, CreateCashAccountDto, CreatePurchaseOrderDto, CreateStaffDto, ReceivePurchaseOrderDto, RetailerCollectionDto, RetailerRefundDto, StockAdjustmentDto, SupplierPaymentDto } from './erp.dto';

const runFile = promisify(execFile);

@Injectable()
export class ErpService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [pendingOrders, lowStock, expiringLots, deliveries, monthlySales, finance] = await Promise.all([
      this.prisma.customerOrder.count({ where: { status: { in: [OrderStatus.PLACED, OrderStatus.PARTIALLY_ACCEPTED] } } }),
      this.prisma.productOffer.count({ where: { isActive: true, stockOnHand: { lte: 5 } } }),
      this.prisma.inventoryMovement.findMany({ where: { type: InventoryMovementType.RECEIPT, expiresAt: { gte: now, lte: horizon } }, include: { offer: { include: { product: { select: { name: true } }, seller: { select: { name: true } } } } }, orderBy: { expiresAt: 'asc' }, take: 100 }),
      this.prisma.shipment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.monthlySales(),
      this.financeSummary(),
    ]);
    return { pendingOrders, lowStock, expiringProducts: expiringLots.length, expiringLots, deliveryStatus: deliveries, monthlySales, ...finance };
  }

  async purchases() {
    return this.prisma.purchaseOrder.findMany({
      include: { supplier: { select: { id: true, name: true, phone: true, email: true } }, createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } }, lines: { include: { product: { select: { id: true, name: true, packSize: true, unit: true } } }, orderBy: { createdAt: 'asc' } }, receipts: { include: { lines: true }, orderBy: { receivedAt: 'desc' } } },
      orderBy: { createdAt: 'desc' }, take: 500,
    });
  }

  async supplierDirectory() {
    const data = await this.prisma.organization.findMany({ where: { type: OrganizationType.SUPPLIER }, select: { id: true, name: true, type: true, email: true, phone: true, verificationStatus: true, verificationReason: true, createdAt: true, _count: { select: { users: true, kycDocuments: true } } }, orderBy: { createdAt: 'desc' }, take: 500 });
    return { data };
  }

  async createPurchaseOrder(actorId: string, dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.organization.findFirst({ where: { id: dto.supplierOrganizationId, type: OrganizationType.SUPPLIER, verificationStatus: VerificationStatus.APPROVED }, select: { id: true } });
    if (!supplier) throw new BadRequestException('Choose an approved supplier');
    const products = await this.prisma.product.findMany({ where: { id: { in: dto.lines.map((line) => line.productId) }, status: { not: 'ARCHIVED' } }, select: { id: true } });
    if (products.length !== dto.lines.length) throw new BadRequestException('Each purchase line must reference an available catalogue product');
    const total = dto.lines.reduce((sum, line) => sum.add(new Prisma.Decimal(line.unitCost).mul(line.quantity)), new Prisma.Decimal(0)).toDecimalPlaces(2);
    const order = await this.prisma.purchaseOrder.create({
      data: { orderNumber: `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`, supplierOrganizationId: supplier.id, createdById: actorId, note: dto.note?.trim() || null, total, lines: { create: dto.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitCost: line.unitCost })) } },
      include: { supplier: { select: { id: true, name: true } }, lines: { include: { product: { select: { id: true, name: true, packSize: true, unit: true } } } } },
    });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'PURCHASE_ORDER_CREATED', entityType: 'PurchaseOrder', entityId: order.id, after: { orderNumber: order.orderNumber, supplierOrganizationId: supplier.id, total: total.toString() } } });
    return order;
  }

  async approvePurchaseOrder(actorId: string, id: string) {
    const current = await this.prisma.purchaseOrder.findUnique({ where: { id }, select: { id: true, status: true, orderNumber: true } });
    if (!current) throw new NotFoundException('Purchase order not found');
    if (current.status === PurchaseOrderStatus.APPROVED || current.status === PurchaseOrderStatus.PARTIALLY_RECEIVED || current.status === PurchaseOrderStatus.RECEIVED) return current;
    if (current.status !== PurchaseOrderStatus.DRAFT) throw new ConflictException('This purchase order cannot be approved');
    const updated = await this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.APPROVED, approvedById: actorId, approvedAt: new Date() } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'PURCHASE_ORDER_APPROVED', entityType: 'PurchaseOrder', entityId: id, before: { status: current.status }, after: { status: updated.status } } });
    return updated;
  }

  async receivePurchaseOrder(actorId: string, id: string, idempotencyKey: string | undefined, dto: ReceivePurchaseOrderDto) {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const previous = await this.prisma.purchaseReceipt.findUnique({ where: { idempotencyKey: key }, include: { lines: true } });
    if (previous) {
      if (previous.purchaseOrderId !== id) throw new ConflictException('This idempotency key was already used for another receipt');
      return previous;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { supplier: true, lines: { include: { product: true } } } });
        if (!order) throw new NotFoundException('Purchase order not found');
        if (order.status !== PurchaseOrderStatus.APPROVED && order.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) throw new ConflictException('Approve this purchase order before receiving stock');
        if (new Set(dto.lines.map((line) => line.lineId)).size !== dto.lines.length) throw new BadRequestException('A purchase line can only appear once per receipt');
        const receiptId = randomUUID();
        const receipt = await tx.purchaseReceipt.create({ data: { id: receiptId, idempotencyKey: key, purchaseOrderId: id, receivedById: actorId } });
        const agriOrg = await tx.organization.findFirst({ where: { type: OrganizationType.AGRI_ONE } }) ?? await tx.organization.create({ data: { name: 'Agri-One', type: OrganizationType.AGRI_ONE, verificationStatus: VerificationStatus.APPROVED } });
        for (const incoming of dto.lines) {
          const line = order.lines.find((item) => item.id === incoming.lineId);
          if (!line) throw new BadRequestException('A received line does not belong to this purchase order');
          if (line.receivedQuantity + incoming.quantity > line.quantity) throw new ConflictException(`Received quantity exceeds the ordered quantity for ${line.product.name}`);
          const updatedLine = await tx.purchaseOrderLine.updateMany({ where: { id: line.id, receivedQuantity: line.receivedQuantity, quantity: { gte: line.receivedQuantity + incoming.quantity } }, data: { receivedQuantity: { increment: incoming.quantity } } });
          if (updatedLine.count !== 1) throw new ConflictException('Purchase line changed while stock was being received; refresh and retry');
          let offer = await tx.productOffer.findFirst({ where: { productId: line.productId, sellerOrganizationId: agriOrg.id, source: FulfillmentSource.AGRI_ONE_STOCK } });
          if (!offer) {
            offer = await tx.productOffer.create({ data: { productId: line.productId, sellerOrganizationId: agriOrg.id, source: FulfillmentSource.AGRI_ONE_STOCK, sellerSku: `AO-ERP-${line.productId}`, price: line.unitCost, mrp: line.unitCost, stockOnHand: incoming.quantity, isActive: line.product.status === 'APPROVED' } });
          } else {
            await tx.productOffer.update({ where: { id: offer.id }, data: { stockOnHand: { increment: incoming.quantity } } });
          }
          await tx.purchaseReceiptLine.create({ data: { receiptId: receipt.id, purchaseOrderLineId: line.id, quantity: incoming.quantity } });
          await tx.inventoryMovement.create({ data: { offerId: offer.id, actorId, type: InventoryMovementType.RECEIPT, quantity: incoming.quantity, reason: `Purchase receipt ${order.orderNumber}`, referenceId: receipt.id } });
        }
        const refreshedLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: id }, select: { quantity: true, receivedQuantity: true } });
        const complete = refreshedLines.every((line) => line.receivedQuantity >= line.quantity);
        await tx.purchaseOrder.update({ where: { id }, data: { status: complete ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED, receivedAt: complete ? new Date() : null } });
        await tx.auditEvent.create({ data: { actorId, action: 'PURCHASE_STOCK_RECEIVED', entityType: 'PurchaseOrder', entityId: id, after: { receiptId: receipt.id, orderNumber: order.orderNumber, lines: dto.lines.map((line) => ({ lineId: line.lineId, quantity: line.quantity })) } } });
        return tx.purchaseReceipt.findUniqueOrThrow({ where: { id: receipt.id }, include: { lines: true } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.purchaseReceipt.findUnique({ where: { idempotencyKey: key }, include: { lines: true } });
        if (existing) return existing;
        throw new ConflictException('A duplicate purchase receipt was prevented; retry with the same idempotency key');
      }
      throw error;
    }
  }

  async createCashAccount(actorId: string, dto: CreateCashAccountDto) {
    if (dto.type === CashAccountType.BANK && !dto.bankName?.trim()) throw new BadRequestException('Bank name is required for a bank account');
    const openingBalance = new Prisma.Decimal(dto.openingBalance);
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.cashBankAccount.create({ data: { name: dto.name.trim(), type: dto.type, bankName: dto.type === CashAccountType.BANK ? dto.bankName?.trim() : null, accountNumberLast4: dto.accountNumberLast4 ?? null, openingBalance, currentBalance: openingBalance } });
      if (openingBalance.gt(0)) await tx.financialTransaction.create({ data: { idempotencyKey: `opening:${account.id}`, type: FinancialTransactionType.OPENING_BALANCE, amount: openingBalance, accountId: account.id, actorId, note: 'Opening balance' } });
      await tx.auditEvent.create({ data: { actorId, action: 'CASH_BANK_ACCOUNT_CREATED', entityType: 'CashBankAccount', entityId: account.id, after: { name: account.name, type: account.type, openingBalance: openingBalance.toString() } } });
      return account;
    });
  }

  async collectRetailerPayment(actorId: string, idempotencyKey: string | undefined, dto: RetailerCollectionDto) {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const existing = await this.prisma.financialTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.customerOrder.findUnique({ where: { id: dto.orderId }, include: { payments: { where: { status: PaymentStatus.PAID }, select: { amount: true } }, retailer: { select: { id: true, type: true } } } });
        if (!order || order.retailerId !== dto.retailerId || order.retailer.type !== OrganizationType.RETAILER) throw new NotFoundException('Retailer order not found');
        if (order.status !== OrderStatus.DELIVERED) throw new ConflictException('Retailer payment can only be collected for a delivered order');
        const due = order.total.sub(order.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0))).toDecimalPlaces(2);
        const amount = new Prisma.Decimal(dto.amount);
        if (amount.gt(due)) throw new BadRequestException(`Receipt exceeds the remaining order due of ${due.toFixed(2)}`);
        await this.creditAccount(tx, dto.accountId, amount);
        const transaction = await tx.financialTransaction.create({ data: { idempotencyKey: key, type: FinancialTransactionType.RETAILER_RECEIPT, amount, accountId: dto.accountId, partyOrganizationId: dto.retailerId, customerOrderId: order.id, reference: dto.reference?.trim() || null, note: dto.note?.trim() || null, actorId } });
        await tx.payment.create({ data: { customerOrderId: order.id, amount, status: PaymentStatus.PAID, provider: 'MANUAL_COLLECTION', providerReference: dto.reference?.trim() || null, idempotencyKey: `receipt:${key}` } });
        await tx.auditEvent.create({ data: { actorId, action: 'RETAILER_PAYMENT_COLLECTED', entityType: 'FinancialTransaction', entityId: transaction.id, after: { retailerId: dto.retailerId, orderId: order.id, amount: amount.toString(), accountId: dto.accountId } } });
        return transaction;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const transaction = await this.prisma.financialTransaction.findUnique({ where: { idempotencyKey: key } });
        if (transaction) return transaction;
        throw new ConflictException('Duplicate payment was prevented; retry with the same idempotency key');
      }
      throw error;
    }
  }

  async paySupplier(actorId: string, idempotencyKey: string | undefined, dto: SupplierPaymentDto) {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const existing = await this.prisma.financialTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) return existing;
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId }, include: { supplier: { select: { id: true } }, lines: { select: { quantity: true, receivedQuantity: true, unitCost: true } }, financialTransactions: { where: { type: FinancialTransactionType.SUPPLIER_PAYMENT }, select: { amount: true } } } });
      if (!order || (order.status !== PurchaseOrderStatus.RECEIVED && order.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED)) throw new ConflictException('Supplier payments require received purchase stock');
      const payable = order.lines.reduce((sum, line) => sum.add(line.unitCost.mul(line.receivedQuantity)), new Prisma.Decimal(0));
      const paid = order.financialTransactions.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
      const due = payable.sub(paid).toDecimalPlaces(2);
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.gt(due)) throw new BadRequestException(`Payment exceeds the remaining supplier due of ${due.toFixed(2)}`);
      await this.debitAccount(tx, dto.accountId, amount);
      const transaction = await tx.financialTransaction.create({ data: { idempotencyKey: key, type: FinancialTransactionType.SUPPLIER_PAYMENT, amount, accountId: dto.accountId, partyOrganizationId: order.supplier.id, purchaseOrderId: order.id, reference: dto.reference?.trim() || null, note: dto.note?.trim() || null, actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'SUPPLIER_PAYMENT_POSTED', entityType: 'FinancialTransaction', entityId: transaction.id, after: { purchaseOrderId: order.id, amount: amount.toString(), accountId: dto.accountId } } });
      return transaction;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
  }

  async refundRetailerReceipt(actorId: string, idempotencyKey: string | undefined, dto: RetailerRefundDto) {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const existing = await this.prisma.financialTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      if (existing.type !== FinancialTransactionType.REFUND) throw new ConflictException('This idempotency key was already used for another transaction');
      return existing;
    }
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.financialTransaction.findUnique({ where: { id: dto.receiptTransactionId }, select: { id: true, type: true, amount: true, partyOrganizationId: true, customerOrderId: true } });
      if (!receipt || receipt.type !== FinancialTransactionType.RETAILER_RECEIPT || !receipt.partyOrganizationId || !receipt.customerOrderId) throw new NotFoundException('Retailer receipt transaction not found');
      const priorRefunds = await tx.financialTransaction.aggregate({ where: { type: FinancialTransactionType.REFUND, reference: receipt.id }, _sum: { amount: true } });
      const remaining = receipt.amount.sub(priorRefunds._sum.amount ?? 0).toDecimalPlaces(2);
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.gt(remaining)) throw new BadRequestException(`Refund exceeds the remaining receipt value of ${remaining.toFixed(2)}`);
      await this.debitAccount(tx, dto.accountId, amount);
      const refund = await tx.financialTransaction.create({ data: { idempotencyKey: key, type: FinancialTransactionType.REFUND, amount, accountId: dto.accountId, partyOrganizationId: receipt.partyOrganizationId, customerOrderId: receipt.customerOrderId, reference: receipt.id, note: dto.reason.trim(), actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'RETAILER_PAYMENT_REFUNDED', entityType: 'FinancialTransaction', entityId: refund.id, after: { receiptTransactionId: receipt.id, amount: amount.toString(), accountId: dto.accountId, reason: dto.reason.trim() } } });
      return refund;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
  }

  async createExpense(actorId: string, idempotencyKey: string | undefined, dto: BusinessExpenseDto) {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const existing = await this.prisma.financialTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) return existing;
    const transactionDate = dto.transactionDate ? new Date(dto.transactionDate) : new Date();
    if (Number.isNaN(transactionDate.getTime())) throw new BadRequestException('Provide a valid transaction date');
    return this.prisma.$transaction(async (tx) => {
      const amount = new Prisma.Decimal(dto.amount);
      await this.debitAccount(tx, dto.accountId, amount);
      const transaction = await tx.financialTransaction.create({ data: { idempotencyKey: key, type: FinancialTransactionType.BUSINESS_EXPENSE, amount, accountId: dto.accountId, category: dto.category.trim(), reference: dto.reference?.trim() || null, note: dto.note.trim(), transactionDate, actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'BUSINESS_EXPENSE_POSTED', entityType: 'FinancialTransaction', entityId: transaction.id, after: { category: transaction.category, amount: amount.toString(), accountId: dto.accountId } } });
      return transaction;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
  }

  async finance() {
    const [accounts, transactions, retailerDues, supplierDues, retailerInvoices, supplierPayables, summary, monthlySales] = await Promise.all([
      this.prisma.cashBankAccount.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
      this.prisma.financialTransaction.findMany({ include: { account: { select: { id: true, name: true, type: true } }, partyOrganization: { select: { id: true, name: true, type: true } }, customerOrder: { select: { orderNumber: true } }, purchaseOrder: { select: { orderNumber: true } }, actor: { select: { id: true, name: true } } }, orderBy: { transactionDate: 'desc' }, take: 300 }),
      this.retailerDues(), this.supplierDues(), this.retailerInvoices(), this.supplierPayables(), this.financeSummary(), this.monthlySales(),
    ]);
    return { accounts, transactions, retailerDues, supplierDues, retailerInvoices, supplierPayables, summary, monthlySales };
  }

  async staff() {
    return this.prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.DELIVERY, UserRole.FINANCE, UserRole.SUPPORT] } }, select: { id: true, name: true, email: true, phone: true, role: true, status: true, adminPermissions: true, isSuperAdmin: true, createdAt: true }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] });
  }

  async createStaff(actorId: string, dto: CreateStaffDto) {
    if (dto.role === 'ADMIN') {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
      if (!actor?.isSuperAdmin) throw new ForbiddenException('Only a super admin can create scoped admin accounts');
    }
    const passwordHash = await hash(dto.password, 12);
    try {
      const user = await this.prisma.user.create({ data: { name: dto.name.trim(), email: dto.email.trim().toLowerCase(), phone: dto.phone?.trim() || null, passwordHash, role: dto.role as UserRole, adminPermissions: dto.role === 'ADMIN' ? (dto.permissions ?? []) as never[] : [], isSuperAdmin: false }, select: { id: true, name: true, email: true, phone: true, role: true, status: true, adminPermissions: true, isSuperAdmin: true, createdAt: true } });
      await this.prisma.auditEvent.create({ data: { actorId, action: 'STAFF_ACCOUNT_CREATED', entityType: 'User', entityId: user.id, after: { role: user.role, adminPermissions: user.adminPermissions } } });
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('That email address or phone number is already registered');
      throw error;
    }
  }

  async setStaffStatus(actorId: string, id: string, status: AccountStatus) {
    const current = await this.prisma.user.findUnique({ where: { id }, select: { id: true, name: true, status: true, role: true, isSuperAdmin: true } });
    if (!current || (current.role !== UserRole.ADMIN && current.role !== UserRole.WAREHOUSE && current.role !== UserRole.DELIVERY && current.role !== UserRole.FINANCE && current.role !== UserRole.SUPPORT)) throw new NotFoundException('Staff account not found');
    if (current.isSuperAdmin) throw new ConflictException('A super admin account cannot be disabled here');
    if (actorId === id && status === AccountStatus.DISABLED) throw new ConflictException('You cannot disable your own staff account');
    const updated = await this.prisma.user.update({ where: { id }, data: { status }, select: { id: true, name: true, role: true, status: true } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'STAFF_STATUS_UPDATED', entityType: 'User', entityId: id, before: { status: current.status }, after: { status: updated.status } } });
    return updated;
  }

  async setStaffPermissions(actorId: string, id: string, permissions: string[]) {
    if (actorId === id) throw new ConflictException('You cannot change your own staff permissions');
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
    if (!actor?.isSuperAdmin) throw new ForbiddenException('Only a super admin can assign admin permissions');
    const current = await this.prisma.user.findUnique({ where: { id }, select: { role: true, adminPermissions: true, isSuperAdmin: true } });
    if (!current || current.role !== UserRole.ADMIN || current.isSuperAdmin) throw new NotFoundException('Scoped admin account not found');
    const safePermissions = permissions as AdminPermission[];
    const updated = await this.prisma.user.update({ where: { id }, data: { adminPermissions: safePermissions }, select: { id: true, name: true, adminPermissions: true } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'STAFF_PERMISSIONS_UPDATED', entityType: 'User', entityId: id, before: { permissions: current.adminPermissions }, after: { permissions: safePermissions } } });
    return updated;
  }

  async activity(query: AdminActivityQueryDto) {
    const where: Prisma.AuditEventWhereInput = { ...(query.entityType ? { entityType: query.entityType } : {}), ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({ where, include: { actor: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async errors() {
    return this.prisma.errorLog.findMany({ include: { actor: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async backups() {
    const rows = await this.prisma.databaseBackup.findMany({ select: { id: true, fileName: true, status: true, sizeBytes: true, errorCode: true, createdAt: true, finishedAt: true, actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((row) => ({ ...row, sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes) }));
  }

  async createDatabaseBackup(actorId: string) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new BadRequestException('Database connection is not configured for backup');
    let parsed: URL;
    try { parsed = new URL(databaseUrl); } catch { throw new BadRequestException('Database connection is not configured for backup'); }
    const backupDirectory = resolve(process.env.DATABASE_BACKUP_DIR || join(process.cwd(), 'private-backups'));
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    const fileName = `agri-one-db-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
    const storagePath = join(backupDirectory, fileName);
    const backup = await this.prisma.databaseBackup.create({ data: { fileName, storagePath, status: 'PENDING', actorId } });
    const args = ['--format=custom', '--no-owner', '--no-privileges', '--host', parsed.hostname, '--port', parsed.port || '5432', '--username', decodeURIComponent(parsed.username), '--dbname', decodeURIComponent(parsed.pathname.replace(/^\//, '')), '--file', storagePath];
    const environment = { ...process.env, PGPASSWORD: decodeURIComponent(parsed.password), ...(parsed.searchParams.get('sslmode') ? { PGSSLMODE: parsed.searchParams.get('sslmode')! } : {}) };
    try {
      await runFile(process.env.PG_DUMP_PATH || 'pg_dump', args, { env: environment, timeout: 300_000, maxBuffer: 1024 * 1024, windowsHide: true });
      const file = await stat(storagePath);
      const updated = await this.prisma.databaseBackup.update({ where: { id: backup.id }, data: { status: 'COMPLETED', sizeBytes: BigInt(file.size), finishedAt: new Date() }, select: { id: true, fileName: true, status: true, sizeBytes: true, createdAt: true, finishedAt: true } });
      await this.prisma.auditEvent.create({ data: { actorId, action: 'DATABASE_BACKUP_CREATED', entityType: 'DatabaseBackup', entityId: backup.id, after: { fileName, sizeBytes: file.size } } });
      return { ...updated, sizeBytes: updated.sizeBytes === null ? null : Number(updated.sizeBytes) };
    } catch (error) {
      await rm(storagePath, { force: true }).catch(() => undefined);
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code.slice(0, 120) : 'BACKUP_COMMAND_FAILED';
      await this.prisma.databaseBackup.update({ where: { id: backup.id }, data: { status: 'FAILED', errorCode: code, finishedAt: new Date() } });
      throw new BadRequestException(code === 'ENOENT' ? 'pg_dump is not installed or PG_DUMP_PATH is not configured' : 'Database backup command failed; check the API server logs');
    }
  }

  async returns() {
    return this.prisma.orderReturnRequest.findMany({ include: { customerOrder: { include: { retailer: { select: { id: true, name: true, phone: true } }, fulfillments: { include: { lines: true } }, payments: { where: { status: PaymentStatus.PAID }, select: { amount: true } } } } }, orderBy: { requestedAt: 'desc' }, take: 500 });
  }

  async adjustInventory(actorId: string, id: string, dto: StockAdjustmentDto) {
    if (dto.quantityDelta === 0) throw new BadRequestException('Adjustment quantity cannot be zero');
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.expiresAt && (!expiresAt || Number.isNaN(expiresAt.getTime()))) throw new BadRequestException('Provide a valid expiration date');
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.productOffer.findUnique({ where: { id }, select: { id: true, stockOnHand: true, reservedQuantity: true, product: { select: { name: true } } } });
      if (!offer) throw new NotFoundException('Inventory offer not found');
      const nextQuantity = offer.stockOnHand + dto.quantityDelta;
      if (nextQuantity < offer.reservedQuantity) throw new BadRequestException('Available stock cannot be adjusted below the quantity reserved for orders');
      const changed = await tx.productOffer.updateMany({ where: { id, stockOnHand: offer.stockOnHand }, data: { stockOnHand: nextQuantity } });
      if (changed.count !== 1) throw new ConflictException('Stock changed during adjustment; refresh and retry');
      const movement = await tx.inventoryMovement.create({ data: { offerId: id, actorId, type: InventoryMovementType.ADJUSTMENT, quantity: dto.quantityDelta, reason: dto.reason.trim(), batchNumber: dto.batchNumber?.trim() || null, expiresAt } });
      await tx.auditEvent.create({ data: { actorId, action: 'INVENTORY_ADJUSTED', entityType: 'ProductOffer', entityId: id, before: { stockOnHand: offer.stockOnHand }, after: { stockOnHand: nextQuantity, delta: dto.quantityDelta, reason: dto.reason.trim(), product: offer.product.name } } });
      return { movement, stockOnHand: nextQuantity };
    });
  }

  private async retailerDues() {
    return this.prisma.$queryRaw<{ id: string; name: string; due: Prisma.Decimal }[]>`
      SELECT o."retailerId" AS id, r."name" AS name,
        SUM(o."total" - COALESCE(p.paid, 0) + COALESCE(rf.refunded, 0)) AS due
      FROM "CustomerOrder" o
      JOIN "Organization" r ON r."id" = o."retailerId"
      LEFT JOIN (SELECT "customerOrderId", SUM("amount") AS paid FROM "Payment" WHERE "status" = 'PAID' GROUP BY "customerOrderId") p ON p."customerOrderId" = o."id"
      LEFT JOIN (SELECT "customerOrderId", SUM("amount") AS refunded FROM "FinancialTransaction" WHERE "type" = 'REFUND' GROUP BY "customerOrderId") rf ON rf."customerOrderId" = o."id"
      WHERE o."status" = 'DELIVERED' AND NOT EXISTS (SELECT 1 FROM "OrderReturnRequest" r WHERE r."customerOrderId" = o."id" AND r."status" = 'COMPLETED')
      GROUP BY o."retailerId", r."name"
      HAVING SUM(o."total" - COALESCE(p.paid, 0) + COALESCE(rf.refunded, 0)) > 0
      ORDER BY due DESC`;
  }

  private async supplierDues() {
    return this.prisma.$queryRaw<{ id: string; name: string; due: Prisma.Decimal }[]>`
      WITH payable AS (
        SELECT po."id", po."supplierOrganizationId", SUM(pol."unitCost" * pol."receivedQuantity") AS amount
        FROM "PurchaseOrder" po JOIN "PurchaseOrderLine" pol ON pol."purchaseOrderId" = po."id"
        WHERE po."status" IN ('RECEIVED', 'PARTIALLY_RECEIVED')
        GROUP BY po."id", po."supplierOrganizationId"
      ), paid AS (
        SELECT "purchaseOrderId", SUM("amount") AS amount FROM "FinancialTransaction"
        WHERE "type" = 'SUPPLIER_PAYMENT' GROUP BY "purchaseOrderId"
      )
      SELECT p."supplierOrganizationId" AS id, s."name" AS name, SUM(p.amount - COALESCE(paid.amount, 0)) AS due
      FROM payable p
      JOIN "Organization" s ON s."id" = p."supplierOrganizationId"
      LEFT JOIN paid ON paid."purchaseOrderId" = p."id"
      GROUP BY p."supplierOrganizationId", s."name"
      HAVING SUM(p.amount - COALESCE(paid.amount, 0)) > 0
      ORDER BY due DESC`;
  }

  private async retailerInvoices() {
    return this.prisma.$queryRaw<{ orderId: string; orderNumber: string; retailerId: string; retailerName: string; total: Prisma.Decimal; due: Prisma.Decimal }[]>`
      SELECT o."id" AS "orderId", o."orderNumber", o."retailerId", r."name" AS "retailerName", o."total",
        o."total" - COALESCE(SUM(p."amount") FILTER (WHERE p."status" = 'PAID'), 0) + COALESCE(rf.refunded, 0) AS due
      FROM "CustomerOrder" o JOIN "Organization" r ON r."id" = o."retailerId"
      LEFT JOIN "Payment" p ON p."customerOrderId" = o."id"
      LEFT JOIN (SELECT "customerOrderId", SUM("amount") AS refunded FROM "FinancialTransaction" WHERE "type" = 'REFUND' GROUP BY "customerOrderId") rf ON rf."customerOrderId" = o."id"
      WHERE o."status" = 'DELIVERED' AND NOT EXISTS (SELECT 1 FROM "OrderReturnRequest" r WHERE r."customerOrderId" = o."id" AND r."status" = 'COMPLETED')
      GROUP BY o."id", o."orderNumber", o."retailerId", r."name", o."total", rf.refunded
      HAVING o."total" - COALESCE(SUM(p."amount") FILTER (WHERE p."status" = 'PAID'), 0) + COALESCE(rf.refunded, 0) > 0
      ORDER BY o."createdAt" ASC`;
  }

  private async supplierPayables() {
    return this.prisma.$queryRaw<{ purchaseOrderId: string; orderNumber: string; supplierId: string; supplierName: string; payable: Prisma.Decimal; due: Prisma.Decimal }[]>`
      WITH payable AS (
        SELECT po."id", po."orderNumber", po."supplierOrganizationId", SUM(pol."unitCost" * pol."receivedQuantity") AS amount
        FROM "PurchaseOrder" po JOIN "PurchaseOrderLine" pol ON pol."purchaseOrderId" = po."id"
        WHERE po."status" IN ('RECEIVED', 'PARTIALLY_RECEIVED') GROUP BY po."id", po."orderNumber", po."supplierOrganizationId"
      ), paid AS (
        SELECT "purchaseOrderId", SUM("amount") AS amount FROM "FinancialTransaction" WHERE "type" = 'SUPPLIER_PAYMENT' GROUP BY "purchaseOrderId"
      )
      SELECT p."id" AS "purchaseOrderId", p."orderNumber", p."supplierOrganizationId" AS "supplierId", s."name" AS "supplierName", p.amount AS payable, p.amount - COALESCE(paid.amount, 0) AS due
      FROM payable p JOIN "Organization" s ON s."id" = p."supplierOrganizationId"
      LEFT JOIN paid ON paid."purchaseOrderId" = p."id"
      WHERE p.amount - COALESCE(paid.amount, 0) > 0 ORDER BY due DESC`;
  }

  private async financeSummary() {
    const [retailerDues, supplierDues, balances, expenses, collected] = await Promise.all([
      this.retailerDues(), this.supplierDues(), this.prisma.cashBankAccount.aggregate({ _sum: { currentBalance: true }, where: { isActive: true } }),
      this.prisma.financialTransaction.aggregate({ _sum: { amount: true }, where: { type: FinancialTransactionType.BUSINESS_EXPENSE } }),
      this.prisma.financialTransaction.aggregate({ _sum: { amount: true }, where: { type: FinancialTransactionType.RETAILER_RECEIPT } }),
    ]);
    return { retailerDue: retailerDues.reduce((sum, row) => sum + Number(row.due), 0), supplierDue: supplierDues.reduce((sum, row) => sum + Number(row.due), 0), cashAndBank: Number(balances._sum.currentBalance ?? 0), expenses: Number(expenses._sum.amount ?? 0), collections: Number(collected._sum.amount ?? 0) };
  }

  private async monthlySales() {
    const rows = await this.prisma.$queryRaw<{ month: Date; total: Prisma.Decimal; orders: bigint }[]>`
      SELECT date_trunc('month', "createdAt") AS month, SUM("total") AS total, COUNT(*) AS orders
      FROM "CustomerOrder"
      WHERE "status" = 'DELIVERED' AND "createdAt" >= date_trunc('month', CURRENT_DATE) - interval '11 months'
        AND NOT EXISTS (SELECT 1 FROM "OrderReturnRequest" r WHERE r."customerOrderId" = "CustomerOrder"."id" AND r."status" = 'COMPLETED')
      GROUP BY date_trunc('month', "createdAt") ORDER BY month ASC`;
    return rows.map((row) => ({ month: row.month.toISOString().slice(0, 7), total: Number(row.total), orders: Number(row.orders) }));
  }

  private async creditAccount(tx: Prisma.TransactionClient, accountId: string, amount: Prisma.Decimal) {
    const account = await tx.cashBankAccount.updateMany({ where: { id: accountId, isActive: true }, data: { currentBalance: { increment: amount } } });
    if (account.count !== 1) throw new NotFoundException('Active cash or bank account not found');
  }

  private async debitAccount(tx: Prisma.TransactionClient, accountId: string, amount: Prisma.Decimal) {
    const account = await tx.cashBankAccount.updateMany({ where: { id: accountId, isActive: true, currentBalance: { gte: amount } }, data: { currentBalance: { decrement: amount } } });
    if (account.count !== 1) throw new BadRequestException('The account is inactive, missing, or has insufficient balance');
  }

  private requireIdempotencyKey(value: string | undefined) {
    if (!value || value.length < 8 || value.length > 128) throw new BadRequestException('Provide an Idempotency-Key header between 8 and 128 characters');
    return value;
  }
}
