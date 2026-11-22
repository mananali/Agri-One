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
      ...(query.category ? { category: { slug: query.category } } : {}),
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
      where: { slug, status: ProductStatus.APPROVED },
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
