import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FulfillmentSource, FulfillmentStatus, InventoryMovementType, OrderStatus, PaymentStatus, Prisma, ProductStatus, ShipmentStatus, UserRole, VerificationStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../common/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutDto, CreateReturnRequestDto } from './orders.dto';
import { DeliveryAddressDto, UpdateDeliveryAddressDto } from './account.dto';
import { StatementQueryDto } from './statement.dto';

type GroupedLine = { offer: { id: string; sellerOrganizationId: string; source: FulfillmentSource; sellerSku: string; price: Prisma.Decimal; taxRate: Prisma.Decimal; commissionRate: Prisma.Decimal; productName: string; productStatus: ProductStatus }; quantity: number; discountAmount: Prisma.Decimal };

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAddresses(user: AuthUser) {
    const organizationId = this.retailerOrganization(user);
    return this.prisma.deliveryAddress.findMany({ where: { organizationId }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  }

  async createAddress(user: AuthUser, dto: DeliveryAddressDto) {
    const organizationId = this.retailerOrganization(user);
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.deliveryAddress.count({ where: { organizationId } });
      const isDefault = dto.isDefault ?? count === 0;
      if (isDefault) await tx.deliveryAddress.updateMany({ where: { organizationId }, data: { isDefault: false } });
      return tx.deliveryAddress.create({ data: { ...dto, organizationId, isDefault, label: dto.label?.trim() || 'Delivery address', recipientName: dto.recipientName.trim(), address: dto.address.trim(), area: dto.area.trim(), district: dto.district.trim() } });
    });
  }

  async updateAddress(user: AuthUser, id: string, dto: UpdateDeliveryAddressDto) {
    const organizationId = this.retailerOrganization(user);
    const current = await this.prisma.deliveryAddress.findFirst({ where: { id, organizationId } });
    if (!current) throw new NotFoundException('Delivery address not found');
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.deliveryAddress.updateMany({ where: { organizationId, id: { not: id } }, data: { isDefault: false } });
      return tx.deliveryAddress.update({ where: { id }, data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() || 'Delivery address' } : {}),
        ...(dto.recipientName !== undefined ? { recipientName: dto.recipientName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.area !== undefined ? { area: dto.area.trim() } : {}),
        ...(dto.district !== undefined ? { district: dto.district.trim() } : {}),
        ...(dto.pinCode !== undefined ? { pinCode: dto.pinCode } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      } });
    });
  }

  async deleteAddress(user: AuthUser, id: string) {
    const organizationId = this.retailerOrganization(user);
    const current = await this.prisma.deliveryAddress.findFirst({ where: { id, organizationId } });
    if (!current) throw new NotFoundException('Delivery address not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryAddress.delete({ where: { id } });
      if (current.isDefault) {
        const next = await tx.deliveryAddress.findFirst({ where: { organizationId }, orderBy: { updatedAt: 'desc' } });
        if (next) await tx.deliveryAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return { id, deleted: true };
  }

  async statement(user: AuthUser, query: StatementQueryDto) {
    const organizationId = this.retailerOrganization(user);
    if ((query.fromDate && !query.toDate) || (!query.fromDate && query.toDate)) throw new BadRequestException('Provide both fromDate and toDate');
    const startDate = query.fromDate ? new Date(`${query.fromDate}T00:00:00.000Z`) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const endDate = query.toDate ? new Date(`${query.toDate}T23:59:59.999Z`) : new Date();
    if (startDate > endDate) throw new BadRequestException('fromDate must be on or before toDate');
    const [orders, wallet] = await Promise.all([
      this.prisma.customerOrder.findMany({
        where: { retailerId: organizationId, createdAt: { gte: startDate, lte: endDate } },
        select: { id: true, orderNumber: true, status: true, subtotal: true, taxTotal: true, total: true, createdAt: true, payments: { select: { amount: true, status: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.wallet.findUnique({ where: { organizationId }, select: { coinBalance: true } }),
    ]);
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);
    return {
      fromDate: startDate.toISOString().slice(0, 10),
      toDate: endDate.toISOString().slice(0, 10),
      orderCount: orders.length,
      totalSpent,
      orderValue: totalSpent,
      refunds: 0,
      profitEarned: 0,
      coins: wallet?.coinBalance ?? 0,
      paymentIntegration: 'NOT_CONNECTED',
      orders,
    };
  }

  private retailerOrganization(user: AuthUser) {
    if (user.role !== UserRole.RETAILER || !user.organizationId) throw new ForbiddenException('A retailer organization is required');
    return user.organizationId;
  }

  async checkout(user: AuthUser, dto: CheckoutDto, idempotencyKey?: string) {
    if (!user.organizationId) throw new BadRequestException('Retailer account has no organization');
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) throw new BadRequestException('Provide an Idempotency-Key header between 8 and 128 characters');
    const retailer = await this.prisma.organization.findUnique({ where: { id: user.organizationId }, select: { id: true, type: true, verificationStatus: true } });
    if (!retailer || retailer.type !== 'RETAILER') throw new ForbiddenException('A retailer organization is required');
    if (retailer.verificationStatus !== VerificationStatus.APPROVED) throw new ForbiddenException('Retailer business verification must be approved before checkout');
    const previous = await this.prisma.customerOrder.findFirst({ where: { retailerId: retailer.id, idempotencyKey }, include: { fulfillments: { include: { lines: true } } } });
    if (previous) return previous;

    const requested = new Map<string, number>();
    for (const item of dto.items) requested.set(item.offerId, (requested.get(item.offerId) ?? 0) + item.quantity);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const offers = await tx.productOffer.findMany({
          where: { id: { in: [...requested.keys()] }, isActive: true, product: { status: ProductStatus.APPROVED }, seller: { verificationStatus: VerificationStatus.APPROVED } },
          include: { product: { select: { name: true, taxRate: true, status: true } }, serviceAreas: { select: { pinCode: true } } },
        });
        if (offers.length !== requested.size) throw new BadRequestException('One or more offers are unavailable');

        const now = new Date();
        const livePromotions = await tx.promotion.findMany({ where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } }, select: { type: true, discountPercent: true, minimumOrderQuantity: true, coinsPer100: true } });
        const orderQuantity = [...requested.values()].reduce((sum, quantity) => sum + quantity, 0);
        const discountPercent = livePromotions
          .filter((promotion) => promotion.discountPercent && (promotion.type === 'FESTIVAL' || (promotion.type === 'BULK' && orderQuantity >= (promotion.minimumOrderQuantity ?? Number.MAX_SAFE_INTEGER))))
          .reduce((best, promotion) => Math.max(best, Number(promotion.discountPercent)), 0);
        const coinsPer100 = livePromotions.filter((promotion) => promotion.type === 'REWARDS').reduce((best, promotion) => Math.max(best, promotion.coinsPer100), 0);

        const groups = new Map<string, { sellerOrganizationId: string; source: FulfillmentSource; lines: GroupedLine[]; subtotal: Prisma.Decimal; taxTotal: Prisma.Decimal }>();
        let subtotal = new Prisma.Decimal(0);
        let grossSubtotal = new Prisma.Decimal(0);
        let taxTotal = new Prisma.Decimal(0);
        let discountTotal = new Prisma.Decimal(0);
        for (const offer of offers) {
          const quantity = requested.get(offer.id)!;
          if (!offer.serviceAreas.some((area) => area.pinCode === dto.deliveryPinCode)) throw new BadRequestException(`${offer.product.name} is not listed as available in PIN code ${dto.deliveryPinCode}`);
          if (quantity < offer.minimumOrderQuantity) throw new BadRequestException(`${offer.product.name} requires a minimum order quantity of ${offer.minimumOrderQuantity}`);
          if (offer.stockOnHand - offer.reservedQuantity < quantity) throw new ConflictException(`Insufficient available stock for ${offer.product.name}`);
          const reservation = await tx.productOffer.updateMany({
            where: { id: offer.id, isActive: true, stockOnHand: { gte: quantity }, reservedQuantity: { lte: offer.stockOnHand - quantity } },
            data: { reservedQuantity: { increment: quantity } },
          });
          if (reservation.count !== 1) throw new ConflictException(`Stock changed while reserving ${offer.product.name}; retry checkout`);

          const gross = offer.price.mul(quantity).toDecimalPlaces(2);
          const discountAmount = gross.mul(discountPercent).div(100).toDecimalPlaces(2);
          const net = gross.sub(discountAmount);
          const tax = net.mul(offer.product.taxRate).div(100).toDecimalPlaces(2);
          const groupKey = `${offer.source}:${offer.sellerOrganizationId}:${offer.warehouseCode ?? ''}`;
          const group = groups.get(groupKey) ?? { sellerOrganizationId: offer.sellerOrganizationId, source: offer.source, lines: [], subtotal: new Prisma.Decimal(0), taxTotal: new Prisma.Decimal(0) };
          group.lines.push({ offer: { id: offer.id, sellerOrganizationId: offer.sellerOrganizationId, source: offer.source, sellerSku: offer.sellerSku, price: offer.price, taxRate: offer.product.taxRate, commissionRate: offer.commissionRate, productName: offer.product.name, productStatus: offer.product.status }, quantity, discountAmount });
          group.subtotal = group.subtotal.add(net);
          group.taxTotal = group.taxTotal.add(tax);
          groups.set(groupKey, group);
          subtotal = subtotal.add(net);
          grossSubtotal = grossSubtotal.add(gross);
          taxTotal = taxTotal.add(tax);
          discountTotal = discountTotal.add(discountAmount);
        }

        const order = await tx.customerOrder.create({ data: {
          orderNumber: `AG-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
          idempotencyKey, paymentMethod: 'COD', retailerId: retailer.id, deliveryName: dto.deliveryName.trim(), deliveryPhone: dto.deliveryPhone,
          deliveryAddress: dto.deliveryAddress.trim(), deliveryArea: dto.deliveryArea.trim(), deliveryDistrict: dto.deliveryDistrict.trim(), deliveryPinCode: dto.deliveryPinCode,
          subtotal: grossSubtotal, taxTotal, discountTotal, rewardPoints: coinsPer100 > 0 ? Math.floor(Number(subtotal.add(taxTotal)) / 100) * coinsPer100 : 0, total: subtotal.add(taxTotal),
        } });

        const cashPayment = await tx.payment.create({ data: {
          customerOrderId: order.id, amount: order.total, status: PaymentStatus.PENDING,
          provider: 'CASH_ON_DELIVERY', idempotencyKey: `cod:${retailer.id}:${idempotencyKey}`,
        } });

        const fulfillments = [];
        for (const group of groups.values()) {
          const fulfillment = await tx.fulfillmentOrder.create({ data: {
            fulfillmentNumber: `FO-${randomUUID().slice(0, 10).toUpperCase()}`, customerOrderId: order.id,
            sellerOrganizationId: group.sellerOrganizationId, source: group.source, subtotal: group.subtotal,
            taxTotal: group.taxTotal, total: group.subtotal.add(group.taxTotal),
            lines: { create: group.lines.map(({ offer, quantity, discountAmount }) => {
              const net = offer.price.mul(quantity).toDecimalPlaces(2).sub(discountAmount);
              const tax = net.mul(offer.taxRate).div(100).toDecimalPlaces(2);
              const commission = net.mul(offer.commissionRate).div(100).toDecimalPlaces(2);
              return { offerId: offer.id, productNameSnapshot: offer.productName, skuSnapshot: offer.sellerSku, sourceSnapshot: offer.source, unitPriceSnapshot: offer.price, quantity, discountAmount, taxRateSnapshot: offer.taxRate, taxAmount: tax, commissionRateSnapshot: offer.commissionRate, commissionAmount: commission, lineTotal: net.add(tax) };
            }) },
            shipment: { create: { status: ShipmentStatus.READY_FOR_PICKUP, events: { create: { status: ShipmentStatus.READY_FOR_PICKUP, note: 'Order received · Cash on delivery' } } } },
          } });
          fulfillments.push(fulfillment);
          for (const { offer, quantity } of group.lines) await tx.inventoryMovement.create({ data: { offerId: offer.id, actorId: user.sub, type: InventoryMovementType.RESERVATION, quantity, reason: 'Checkout stock reservation', referenceId: fulfillment.id } });
        }
        await tx.auditEvent.create({ data: { actorId: user.sub, action: 'ORDER_PLACED', entityType: 'CustomerOrder', entityId: order.id, after: { orderNumber: order.orderNumber, fulfillmentCount: fulfillments.length, sourceTypes: [...new Set(fulfillments.map((f) => f.source))] } } });
        return { ...order, payment: cashPayment, fulfillments };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
        const existing = await this.prisma.customerOrder.findFirst({ where: { retailerId: retailer.id, idempotencyKey }, include: { fulfillments: { include: { lines: true } } } });
        if (existing) return existing;
        throw new ConflictException('Stock changed during checkout; retry with the same idempotency key');
      }
      throw error;
    }
  }

  async listOrders(user: AuthUser) {
    if (!user.organizationId && user.role !== UserRole.ADMIN) throw new ForbiddenException();
    if (user.role === UserRole.RETAILER) return this.prisma.customerOrder.findMany({
      where: { retailerId: user.organizationId! },
      include: {
        fulfillments: {
          include: {
            lines: { include: { offer: { select: { product: { select: { imageUrl: true } } } } } },
            shipment: true,
          },
        },
        returnRequests: { orderBy: { requestedAt: 'desc' }, take: 1 },
        payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, amount: true, status: true, provider: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (user.role === UserRole.SUPPLIER) return this.prisma.fulfillmentOrder.findMany({ where: { sellerOrganizationId: user.organizationId! }, include: { customerOrder: { select: { orderNumber: true, deliveryDistrict: true, deliveryPinCode: true, createdAt: true } }, lines: true, shipment: true }, orderBy: { createdAt: 'desc' } });
    if (user.role === UserRole.ADMIN || user.role === UserRole.FINANCE || user.role === UserRole.SUPPORT || user.role === UserRole.WAREHOUSE || user.role === UserRole.DELIVERY) return this.prisma.customerOrder.findMany({ include: { fulfillments: { include: { lines: true, shipment: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    throw new ForbiddenException();
  }

  async orderByNumber(user: AuthUser, orderNumber: string) {
    const order = await this.prisma.customerOrder.findUnique({
      where: { orderNumber },
      include: {
        retailer: { select: { id: true, name: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, amount: true, status: true, provider: true, createdAt: true } },
        fulfillments: {
          include: {
            lines: { include: { offer: { select: { product: { select: { imageUrl: true } } } } } },
            shipment: { include: { events: { orderBy: { occurredAt: 'desc' }, take: 20 } } },
            seller: { select: { id: true, name: true } },
          },
        },
        returnRequests: { orderBy: { requestedAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (user.role === UserRole.ADMIN || user.role === UserRole.FINANCE || user.role === UserRole.SUPPORT) return order;
    if (user.role === UserRole.RETAILER && order.retailerId === user.organizationId) return order;
    if (user.role === UserRole.SUPPLIER && order.fulfillments.some((item) => item.sellerOrganizationId === user.organizationId)) return order;
    throw new ForbiddenException('You cannot view this order');
  }

  async invoice(user: AuthUser, orderNumber: string) {
    const order = await this.orderByNumber(user, orderNumber);
    return { invoiceNumber: `INV-${order.orderNumber}`, issuedAt: order.createdAt, seller: 'Agri-One Marketplace', retailer: order.retailer.name, order };
  }

  async requestReturn(user: AuthUser, orderNumber: string, dto: CreateReturnRequestDto) {
    if (user.role !== UserRole.RETAILER || !user.organizationId) throw new ForbiddenException();
    const order = await this.prisma.customerOrder.findFirst({ where: { orderNumber, retailerId: user.organizationId }, include: { returnRequests: { where: { status: { in: ['REQUESTED', 'APPROVED'] } }, select: { id: true }, take: 1 } } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.DELIVERED) throw new BadRequestException('Only delivered orders can be returned');
    if (order.returnRequests.length) throw new ConflictException('A return request is already active for this order');
    return this.prisma.orderReturnRequest.create({ data: { customerOrderId: order.id, reason: dto.reason.trim() } });
  }

  async decideFulfillment(user: AuthUser, fulfillmentId: string, accept: boolean, reason?: string) {
    const organizationId = user.organizationId;
    if (!organizationId) throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const fulfillment = await tx.fulfillmentOrder.findFirst({ where: { id: fulfillmentId, sellerOrganizationId: organizationId, source: FulfillmentSource.MARKETPLACE, status: FulfillmentStatus.NEW }, include: { lines: true } });
      if (!fulfillment) throw new NotFoundException('New marketplace fulfillment not found for this supplier');
      const status = accept ? FulfillmentStatus.ACCEPTED : FulfillmentStatus.REJECTED;
      if (!accept) await this.releaseReservations(tx, fulfillment, user.sub, reason?.trim() || 'Supplier rejected the fulfillment');
      await tx.fulfillmentOrder.update({ where: { id: fulfillment.id }, data: { status, rejectionReason: accept ? null : reason?.trim() || 'Supplier rejected the fulfillment' } });
      await tx.auditEvent.create({ data: { actorId: user.sub, action: accept ? 'FULFILLMENT_ACCEPTED' : 'FULFILLMENT_REJECTED', entityType: 'FulfillmentOrder', entityId: fulfillment.id, before: { status: fulfillment.status }, after: { status, reason: accept ? null : reason?.trim() } } });
      await this.updateParentStatus(tx, fulfillment.customerOrderId);
      return tx.fulfillmentOrder.findUnique({ where: { id: fulfillment.id }, include: { lines: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async releaseReservations(tx: Prisma.TransactionClient, fulfillment: { id: string; lines: { offerId: string; quantity: number }[] }, actorId: string, reason: string) {
    for (const line of fulfillment.lines) {
      const result = await tx.productOffer.updateMany({ where: { id: line.offerId, reservedQuantity: { gte: line.quantity } }, data: { reservedQuantity: { decrement: line.quantity } } });
      if (result.count !== 1) throw new ConflictException('Reserved inventory is inconsistent; contact operations');
      await tx.inventoryMovement.create({ data: { offerId: line.offerId, actorId, type: InventoryMovementType.RELEASE, quantity: line.quantity, reason, referenceId: fulfillment.id } });
    }
  }

  private async updateParentStatus(tx: Prisma.TransactionClient, orderId: string) {
    const fulfillments = await tx.fulfillmentOrder.findMany({ where: { customerOrderId: orderId }, select: { status: true } });
    const statuses = fulfillments.map((item) => item.status);
    const terminal = statuses.every((status) => new Set<FulfillmentStatus>([FulfillmentStatus.DELIVERED, FulfillmentStatus.REJECTED, FulfillmentStatus.CANCELLED]).has(status));
    let status: OrderStatus = OrderStatus.PLACED;
    if (statuses.every((s) => s === FulfillmentStatus.REJECTED || s === FulfillmentStatus.CANCELLED)) status = OrderStatus.REJECTED;
    else if (statuses.every((s) => s === FulfillmentStatus.DELIVERED)) status = OrderStatus.DELIVERED;
    else if (statuses.every((s) => new Set<FulfillmentStatus>([FulfillmentStatus.DISPATCHED, FulfillmentStatus.DELIVERED]).has(s))) status = statuses.every((s) => s === FulfillmentStatus.DELIVERED) ? OrderStatus.DELIVERED : OrderStatus.DISPATCHED;
    else if (statuses.some((s) => s === FulfillmentStatus.ACCEPTED || s === FulfillmentStatus.PICKING) && statuses.some((s) => s === FulfillmentStatus.NEW || s === FulfillmentStatus.REJECTED)) status = OrderStatus.PARTIALLY_ACCEPTED;
    else if (statuses.every((s) => new Set<FulfillmentStatus>([FulfillmentStatus.ACCEPTED, FulfillmentStatus.PICKING, FulfillmentStatus.DISPATCHED, FulfillmentStatus.DELIVERED]).has(s))) status = OrderStatus.ACCEPTED;
    else if (terminal) status = OrderStatus.PARTIALLY_CANCELLED;
    await tx.customerOrder.update({ where: { id: orderId }, data: { status } });
  }
}
