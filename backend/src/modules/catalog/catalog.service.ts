import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FulfillmentSource, InventoryMovementType, ProductStatus, VerificationStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustStockDto, CatalogQueryDto, CreateSupplierProductDto } from './catalog.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, description: true } });
  }

  async homeCategoryCards() {
    const cards = await this.prisma.homeCategoryCard.findMany({ select: { slug: true, imageUrl: true } });
    return Object.fromEntries(cards.map(({ slug, imageUrl }) => [slug, imageUrl]));
  }

  listPromotions() {
    const now = new Date();
    return this.prisma.promotion.findMany({ where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } }, orderBy: { startsAt: 'asc' }, select: { id: true, title: true, body: true, type: true, discountPercent: true, minimumOrderQuantity: true, coinsPer100: true, startsAt: true, endsAt: true } });
  }

  async mobileHomeTopSelling() {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key: 'mobile.home.top-selling' }, select: { value: true } });
    const value = setting?.value && typeof setting.value === 'object' && !Array.isArray(setting.value) ? setting.value as Record<string, unknown> : {};
    const enabled = typeof value.enabled === 'boolean' ? value.enabled : true;
    const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : '🔥 Top Selling';
    let subtitle = typeof value.subtitle === 'string' && value.subtitle.trim() ? value.subtitle.trim() : 'Most ordered products this week';
    const selectedIds = Array.isArray(value.productIds) ? value.productIds.filter((id): id is string => typeof id === 'string').slice(0, 9) : [];
    if (!enabled) return { enabled, title, subtitle, products: [] };

    let productIds = selectedIds;
    if (!productIds.length) {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sales = await this.prisma.orderLine.groupBy({
        by: ['offerId'],
        where: { fulfillmentOrder: { status: { notIn: ['CANCELLED', 'REJECTED'] }, customerOrder: { createdAt: { gte: weekAgo }, status: { notIn: ['CANCELLED', 'REJECTED'] } } } },
        _sum: { quantity: true },
      });
      const offerSales = sales.sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0)).slice(0, 45);
      const productSales = new Map<string, number>();
      if (offerSales.length) {
        const offers = await this.prisma.productOffer.findMany({ where: { id: { in: offerSales.map((item) => item.offerId) } }, select: { id: true, productId: true } });
        const productByOffer = new Map(offers.map((offer) => [offer.id, offer.productId]));
        for (const sale of offerSales) {
          const id = productByOffer.get(sale.offerId);
          if (id) productSales.set(id, (productSales.get(id) ?? 0) + (sale._sum.quantity ?? 0));
        }
      }
      productIds = [...productSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9).map(([id]) => id);
      if (!productIds.length) {
        const recentProducts = await this.prisma.product.findMany({
          where: { status: ProductStatus.APPROVED, category: { isActive: true }, offers: { some: { isActive: true, seller: { verificationStatus: VerificationStatus.APPROVED } } } },
          orderBy: { createdAt: 'desc' }, take: 9, select: { id: true },
        });
        productIds = recentProducts.map((product) => product.id);
        if (productIds.length) subtitle = 'Popular products from Agri-One';
      }
    }
    if (!productIds.length) return { enabled, title, subtitle, products: [] };

    const records = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: ProductStatus.APPROVED, category: { isActive: true }, offers: { some: { isActive: true, seller: { verificationStatus: VerificationStatus.APPROVED } } } },
      include: {
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
        offers: { where: { isActive: true, seller: { verificationStatus: VerificationStatus.APPROVED } }, include: { seller: { select: { id: true, name: true } } }, orderBy: { price: 'asc' } },
      },
    });
    const byId = new Map(records.map((record) => [record.id, record]));
    const products = productIds.flatMap((id) => {
      const record = byId.get(id);
      if (!record) return [];
      const offers = record.offers.map((offer) => ({ ...offer, availableStock: Math.max(0, offer.stockOnHand - offer.reservedQuantity) })).filter((offer) => offer.availableStock >= offer.minimumOrderQuantity);
      if (!offers.length) return [];
      return [{ ...record, offers }];
    });
    return { enabled, title, subtitle, products };
  }

  listBrands() {
    return this.prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, description: true, imageUrl: true } });
  }

  async listProducts(query: CatalogQueryDto) {
    const offerFilters = {
      isActive: true,
      seller: { verificationStatus: VerificationStatus.APPROVED },
      ...(query.source && Object.values(FulfillmentSource).includes(query.source as FulfillmentSource) ? { source: query.source as FulfillmentSource } : {}),
      ...(query.pinCode ? { serviceAreas: { some: { pinCode: query.pinCode } } } : {}),
    };
    const where = {
      status: ProductStatus.APPROVED,
      category: { isActive: true, ...(query.category ? { slug: query.category } : {}) },
      ...(query.brand ? { brand: { slug: query.brand } } : {}),
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
        { brand: { name: { contains: query.search, mode: 'insensitive' as const } } },
        { category: { name: { contains: query.search, mode: 'insensitive' as const } } },
      ] } : {}),
      offers: { some: offerFilters },
    };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true, slug: true } },
          offers: { where: offerFilters, include: { seller: { select: { id: true, name: true } }, serviceAreas: { select: { pinCode: true } } }, orderBy: { price: 'asc' } },
        },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      data: products.map((product) => ({
        ...product,
        offers: product.offers.map((offer) => ({ ...offer, availableStock: Math.max(0, offer.stockOnHand - offer.reservedQuantity) })),
      })),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }

  async productBySlug(slug: string, pinCode?: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.APPROVED, category: { isActive: true } },
      include: {
        category: true,
        brand: true,
        offers: {
          where: { isActive: true, seller: { verificationStatus: VerificationStatus.APPROVED }, ...(pinCode ? { serviceAreas: { some: { pinCode } } } : {}) },
          include: { seller: { select: { id: true, name: true } }, serviceAreas: { select: { pinCode: true } } },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return { ...product, offers: product.offers.map((offer) => ({ ...offer, availableStock: Math.max(0, offer.stockOnHand - offer.reservedQuantity) })) };
  }

  async submitSupplierProduct(userId: string, organizationId: string | null, dto: CreateSupplierProductDto) {
    if (!organizationId) throw new BadRequestException('Supplier account has no organization');
    const supplier = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, type: true } });
    if (!supplier || supplier.type !== 'SUPPLIER') throw new BadRequestException('A supplier organization is required');
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('Choose an existing product category');
    if (dto.brandId && !(await this.prisma.brand.findUnique({ where: { id: dto.brandId } }))) throw new BadRequestException('Choose an existing product brand');
    const slug = `${dto.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)}-${randomUUID().slice(0, 6)}`;
    return this.prisma.product.create({
      data: {
        name: dto.name.trim(), slug, categoryId: category.id, brandId: dto.brandId,
        description: dto.description?.trim(), packSize: dto.packSize.trim(), unit: dto.unit.trim(), status: ProductStatus.PENDING_REVIEW,
        offers: { create: {
          sellerOrganizationId: organizationId, source: FulfillmentSource.MARKETPLACE, sellerSku: dto.sellerSku.trim(),
          price: dto.price, mrp: dto.mrp, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.initialStock,
          isActive: false, serviceAreas: { create: (dto.servicePinCodes ?? []).map((pinCode) => ({ pinCode })) },
        } },
      },
      include: { offers: true, category: { select: { name: true } }, brand: { select: { name: true } } },
    }).then(async (product) => {
      await this.prisma.auditEvent.create({ data: { actorId: userId, action: 'PRODUCT_SUBMITTED', entityType: 'Product', entityId: product.id, after: { status: product.status, sellerOrganizationId: organizationId } } });
      return product;
    });
  }

  async adjustOwnOfferStock(userId: string, organizationId: string | null, offerId: string, dto: AdjustStockDto) {
    if (!organizationId) throw new BadRequestException('Supplier account has no organization');
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.productOffer.findFirst({ where: { id: offerId, sellerOrganizationId: organizationId }, select: { id: true, stockOnHand: true, reservedQuantity: true } });
      if (!offer) throw new NotFoundException('Supplier offer not found');
      if (dto.stockOnHand < offer.reservedQuantity) throw new BadRequestException('Stock cannot be set below the quantity reserved for open orders');
      const updated = await tx.productOffer.update({ where: { id: offer.id }, data: { stockOnHand: dto.stockOnHand } });
      const difference = dto.stockOnHand - offer.stockOnHand;
      if (difference !== 0) await tx.inventoryMovement.create({ data: { offerId, actorId: userId, type: InventoryMovementType.ADJUSTMENT, quantity: difference, reason: dto.reason } });
      return { id: updated.id, stockOnHand: updated.stockOnHand, reservedQuantity: updated.reservedQuantity, availableStock: updated.stockOnHand - updated.reservedQuantity };
    });
  }
}
