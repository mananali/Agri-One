import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, FulfillmentSource, InventoryMovementType, OrderStatus, OrganizationType, ProductStatus, UserRole, VerificationStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminListQueryDto, AdminNamedRecordDto, AdminOfferDto, AdminOrganizationsQueryDto, AdminOrderStatusDto, AdminProductDto, AdminUserStatusDto, ReviewOrganizationDto, ReviewProductDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [users, retailers, suppliers, products, pendingProducts, orders, pendingOrganizations, revenue] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.organization.count({ where: { type: OrganizationType.RETAILER } }),
      this.prisma.organization.count({ where: { type: OrganizationType.SUPPLIER } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: ProductStatus.PENDING_REVIEW } }),
      this.prisma.customerOrder.count(),
      this.prisma.organization.count({ where: { verificationStatus: VerificationStatus.PENDING, type: { in: [OrganizationType.RETAILER, OrganizationType.SUPPLIER] } } }),
      this.prisma.customerOrder.aggregate({ _sum: { total: true }, where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REJECTED] } } }),
    ]);
    return { users, retailers, suppliers, products, pendingProducts, orders, pendingOrganizations, revenue: Number(revenue._sum.total ?? 0) };
  }

  async organizations(query: AdminOrganizationsQueryDto) {
    const where = { ...(query.type ? { type: query.type } : {}), ...(query.status ? { verificationStatus: query.status } : {}) };
    const pageSize = 25;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({ where, select: { id: true, name: true, type: true, email: true, phone: true, verificationStatus: true, verificationReason: true, createdAt: true, _count: { select: { users: true, kycDocuments: true } } }, orderBy: { createdAt: 'desc' }, skip: (Math.max(1, query.page) - 1) * pageSize, take: pageSize }),
      this.prisma.organization.count({ where }),
    ]);
    return { data, pagination: { page: Math.max(1, query.page), pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async reviewOrganization(actorId: string, id: string, dto: ReviewOrganizationDto) {
    const current = await this.prisma.organization.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Organization not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({ where: { id }, data: { verificationStatus: dto.status as VerificationStatus, verificationReason: dto.status === 'APPROVED' ? null : dto.reason?.trim() ?? 'Review action requires follow-up' } });
      if (updated.type === 'SUPPLIER' && updated.verificationStatus === VerificationStatus.APPROVED) await tx.productOffer.updateMany({ where: { sellerOrganizationId: id, product: { status: ProductStatus.APPROVED } }, data: { isActive: true } });
      await tx.auditEvent.create({ data: { actorId, action: 'ORGANIZATION_VERIFICATION_UPDATED', entityType: 'Organization', entityId: id, before: { verificationStatus: current.verificationStatus, verificationReason: current.verificationReason }, after: { verificationStatus: updated.verificationStatus, verificationReason: updated.verificationReason } } });
      return { id: updated.id, name: updated.name, type: updated.type, verificationStatus: updated.verificationStatus, verificationReason: updated.verificationReason };
    });
  }

  async listProducts(query: AdminListQueryDto) {
    const where: Prisma.ProductWhereInput = {
      ...(query.status ? { status: query.status as ProductStatus } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search, mode: 'insensitive' } }, { brand: { name: { contains: query.search, mode: 'insensitive' } } }] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, include: { category: { select: { id: true, name: true, slug: true } }, brand: { select: { id: true, name: true, slug: true } }, offers: { include: { seller: { select: { id: true, name: true, type: true } } }, orderBy: { createdAt: 'asc' } } }, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.product.count({ where }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async createProduct(actorId: string, dto: AdminProductDto) {
    const [category, brand] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: dto.categoryId } }),
      dto.brandId ? this.prisma.brand.findUnique({ where: { id: dto.brandId } }) : Promise.resolve(null),
    ]);
    if (!category) throw new BadRequestException('Choose an existing category');
    if (dto.brandId && !brand) throw new BadRequestException('Choose an existing brand');
    const organization = await this.getOrCreateAgriOrganization();
    const baseSlug = slugify(dto.name).slice(0, 80) || 'product';
    const status = (dto.status ?? 'APPROVED') as ProductStatus;
    try {
      const product = await this.prisma.product.create({
        data: {
          name: dto.name.trim(), slug: `${baseSlug}-${randomUUID().slice(0, 6)}`, categoryId: category.id, brandId: brand?.id ?? null,
          description: dto.description?.trim() || null, imageUrl: dto.imageUrl || null, packSize: dto.packSize.trim(), unit: dto.unit.trim(), taxRate: dto.taxRate, status,
          offers: { create: { sellerOrganizationId: organization.id, source: FulfillmentSource.AGRI_ONE_STOCK, sellerSku: dto.sellerSku.trim(), price: dto.price, mrp: dto.mrp ?? dto.price, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.stockOnHand, isActive: status === ProductStatus.APPROVED } },
        },
        include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } }, offers: true },
      });
      await this.prisma.auditEvent.create({ data: { actorId, action: 'ADMIN_PRODUCT_CREATED', entityType: 'Product', entityId: product.id, after: { name: product.name, status, imageUrl: product.imageUrl } } });
      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('This seller SKU is already in use');
      throw error;
    }
  }

  async updateProduct(actorId: string, id: string, dto: AdminProductDto) {
    const current = await this.prisma.product.findUnique({ where: { id }, include: { offers: { where: { source: FulfillmentSource.AGRI_ONE_STOCK }, take: 1 } } });
    if (!current) throw new NotFoundException('Product not found');
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    const brand = dto.brandId ? await this.prisma.brand.findUnique({ where: { id: dto.brandId } }) : null;
    if (!category) throw new BadRequestException('Choose an existing category');
    if (dto.brandId && !brand) throw new BadRequestException('Choose an existing brand');
    const status = (dto.status ?? current.status) as ProductStatus;
    const active = status === ProductStatus.APPROVED;
    const offer = current.offers[0];
    if (offer && dto.stockOnHand < offer.reservedQuantity) throw new BadRequestException('Stock cannot be set below the quantity reserved for open orders');
    const updated = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({ where: { id }, data: { name: dto.name.trim(), categoryId: category.id, brandId: brand?.id ?? null, description: dto.description?.trim() || null, imageUrl: dto.imageUrl || null, packSize: dto.packSize.trim(), unit: dto.unit.trim(), taxRate: dto.taxRate, status, rejectionReason: null } });
      if (offer) await tx.productOffer.update({ where: { id: offer.id }, data: { sellerSku: dto.sellerSku.trim(), price: dto.price, mrp: dto.mrp ?? dto.price, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.stockOnHand, isActive: active } });
      else {
        const organization = await tx.organization.findFirst({ where: { type: OrganizationType.AGRI_ONE } });
        if (!organization) throw new NotFoundException('Agri-One stock organization is missing');
        await tx.productOffer.create({ data: { productId: id, sellerOrganizationId: organization.id, source: FulfillmentSource.AGRI_ONE_STOCK, sellerSku: dto.sellerSku.trim(), price: dto.price, mrp: dto.mrp ?? dto.price, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.stockOnHand, isActive: active } });
      }
      await tx.productOffer.updateMany({ where: { productId: id, source: FulfillmentSource.MARKETPLACE, ...(active ? { seller: { verificationStatus: VerificationStatus.APPROVED } } : {}) }, data: { isActive: active } });
      await tx.auditEvent.create({ data: { actorId, action: 'ADMIN_PRODUCT_UPDATED', entityType: 'Product', entityId: id, before: { status: current.status, imageUrl: current.imageUrl }, after: { status, imageUrl: product.imageUrl } } });
      return tx.product.findUniqueOrThrow({ where: { id }, include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } }, offers: { include: { seller: { select: { id: true, name: true, type: true } } } } } });
    });
    return updated;
  }

  async archiveProduct(actorId: string, id: string) {
    const current = await this.prisma.product.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!current) throw new NotFoundException('Product not found');
    if (current.status === ProductStatus.ARCHIVED) return { id, status: ProductStatus.ARCHIVED };
    const updated = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED }, select: { id: true, name: true, status: true } });
      await tx.productOffer.updateMany({ where: { productId: id }, data: { isActive: false } });
      await tx.auditEvent.create({ data: { actorId, action: 'ADMIN_PRODUCT_ARCHIVED', entityType: 'Product', entityId: id, before: { name: current.name, status: current.status }, after: { name: product.name, status: product.status } } });
      return product;
    });
    return updated;
  }

  async pendingProducts(page = 1) { return this.listProducts({ page: Math.max(page, 1), pageSize: 25, status: 'PENDING_REVIEW' }); }

  async updateOffer(actorId: string, id: string, dto: AdminOfferDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.productOffer.findUnique({ where: { id }, include: { seller: { select: { verificationStatus: true } }, product: { select: { status: true } } } });
      if (!current) throw new NotFoundException('Product offer not found');
      if (dto.stockOnHand < current.reservedQuantity) throw new BadRequestException('Stock cannot be set below the quantity reserved for open orders');
      if (dto.isActive && (current.product.status !== ProductStatus.APPROVED || current.seller.verificationStatus !== VerificationStatus.APPROVED)) throw new BadRequestException('Approve the product and seller before activating this offer');
      const updated = await tx.productOffer.update({ where: { id }, data: { price: dto.price, mrp: dto.mrp, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.stockOnHand, commissionRate: dto.commissionRate, isActive: dto.isActive } });
      const difference = dto.stockOnHand - current.stockOnHand;
      if (difference !== 0) await tx.inventoryMovement.create({ data: { offerId: id, actorId, type: InventoryMovementType.ADJUSTMENT, quantity: difference, reason: 'Admin inventory adjustment' } });
      await tx.auditEvent.create({ data: { actorId, action: 'ADMIN_OFFER_UPDATED', entityType: 'ProductOffer', entityId: id, before: { price: current.price.toString(), stockOnHand: current.stockOnHand, isActive: current.isActive }, after: { price: updated.price.toString(), stockOnHand: updated.stockOnHand, isActive: updated.isActive } } });
      return updated;
    });
  }

  async reviewProduct(actorId: string, id: string, dto: ReviewProductDto) {
    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Product not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: { status: dto.status as ProductStatus, rejectionReason: dto.status === 'APPROVED' ? null : dto.reason?.trim() ?? 'Product needs changes before approval' } });
      await tx.productOffer.updateMany({ where: { productId: id, seller: { verificationStatus: VerificationStatus.APPROVED } }, data: { isActive: dto.status === 'APPROVED' } });
      await tx.auditEvent.create({ data: { actorId, action: 'PRODUCT_REVIEWED', entityType: 'Product', entityId: id, before: { status: current.status, rejectionReason: current.rejectionReason }, after: { status: updated.status, rejectionReason: updated.rejectionReason } } });
      return updated;
    });
  }

  async organizationsListRecords() {
    const [categories, brands] = await this.prisma.$transaction([
      this.prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }),
      this.prisma.brand.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }),
    ]);
    return { categories, brands };
  }

  async homeCategoryCards() {
    const cards = await this.prisma.homeCategoryCard.findMany({ orderBy: { slug: 'asc' } });
    return Object.fromEntries(cards.map(({ slug, imageUrl }) => [slug, imageUrl]));
  }

  async saveHomeCategoryCardImage(actorId: string, slug: string, imageUrl: string) {
    const current = await this.prisma.homeCategoryCard.findUnique({ where: { slug } });
    const updated = await this.prisma.homeCategoryCard.upsert({ where: { slug }, create: { slug, imageUrl }, update: { imageUrl } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'HOME_CATEGORY_CARD_IMAGE_UPDATED', entityType: 'HomeCategoryCard', entityId: slug, before: current ? { imageUrl: current.imageUrl } : undefined, after: { imageUrl } } });
    return { slug: updated.slug, imageUrl: updated.imageUrl };
  }

  async createCategory(actorId: string, dto: AdminNamedRecordDto) {
    try {
      const item = await this.prisma.category.create({ data: { name: dto.name.trim(), slug: slugify(dto.name), description: dto.description?.trim() || null } });
      await this.auditEvent(actorId, 'CATEGORY_CREATED', 'Category', item.id, { name: item.name });
      return item;
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Category name already exists'); throw error; }
  }

  async createBrand(actorId: string, dto: AdminNamedRecordDto) {
    try {
      const item = await this.prisma.brand.create({ data: { name: dto.name.trim(), slug: slugify(dto.name), description: dto.description?.trim() || null, imageUrl: dto.imageUrl || null } });
      await this.auditEvent(actorId, 'BRAND_CREATED', 'Brand', item.id, { name: item.name, description: item.description, imageUrl: item.imageUrl });
      return item;
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Brand name already exists'); throw error; }
  }

  async updateBrand(actorId: string, id: string, dto: AdminNamedRecordDto) {
    const current = await this.prisma.brand.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Brand not found');
    try {
      const updated = await this.prisma.brand.update({ where: { id }, data: { name: dto.name.trim(), slug: slugify(dto.name), description: dto.description?.trim() || null, imageUrl: dto.imageUrl || null } });
      await this.prisma.auditEvent.create({ data: { actorId, action: 'BRAND_UPDATED', entityType: 'Brand', entityId: id, before: { name: current.name, description: current.description, imageUrl: current.imageUrl }, after: { name: updated.name, description: updated.description, imageUrl: updated.imageUrl } } });
      return updated;
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Brand name already exists'); throw error; }
  }

  async setCatalogStatus(actorId: string, kind: 'category' | 'brand', id: string, isActive: boolean) {
    if (kind === 'category') {
      const current = await this.prisma.category.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Category not found');
      const updated = await this.prisma.category.update({ where: { id }, data: { isActive } });
      await this.auditEvent(actorId, 'CATEGORY_STATUS_UPDATED', 'Category', id, { name: updated.name, isActive });
      return updated;
    }
    const current = await this.prisma.brand.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Brand not found');
    const updated = await this.prisma.brand.update({ where: { id }, data: { isActive } });
    await this.auditEvent(actorId, 'BRAND_STATUS_UPDATED', 'Brand', id, { name: updated.name, isActive });
    return updated;
  }

  async users(query: AdminListQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status as AccountStatus } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }, { organization: { name: { contains: query.search, mode: 'insensitive' } } }] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, organization: { select: { id: true, name: true, type: true, verificationStatus: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.user.count({ where }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async setUserStatus(actorId: string, targetId: string, dto: AdminUserStatusDto) {
    const current = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true, status: true, role: true, name: true } });
    if (!current) throw new NotFoundException('User not found');
    if (actorId === targetId && dto.status === 'DISABLED') throw new ForbiddenException('You cannot disable your own admin account');
    const updated = await this.prisma.user.update({ where: { id: targetId }, data: { status: dto.status as AccountStatus }, select: { id: true, name: true, role: true, status: true } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'USER_STATUS_UPDATED', entityType: 'User', entityId: targetId, before: { status: current.status }, after: { status: updated.status } } });
    return updated;
  }

  async orders(query: AdminListQueryDto) {
    const where: Prisma.CustomerOrderWhereInput = {
      ...(query.status ? { status: query.status as OrderStatus } : {}),
      ...(query.search ? { OR: [{ orderNumber: { contains: query.search, mode: 'insensitive' } }, { retailer: { name: { contains: query.search, mode: 'insensitive' } } }, { deliveryName: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customerOrder.findMany({ where, include: { retailer: { select: { id: true, name: true } }, fulfillments: { include: { seller: { select: { id: true, name: true } }, lines: true, shipment: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.customerOrder.count({ where }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async setOrderStatus(actorId: string, id: string, dto: AdminOrderStatusDto) {
    const current = await this.prisma.customerOrder.findUnique({ where: { id }, select: { id: true, orderNumber: true, status: true } });
    if (!current) throw new NotFoundException('Order not found');
    const updated = await this.prisma.customerOrder.update({ where: { id }, data: { status: dto.status as OrderStatus }, select: { id: true, orderNumber: true, status: true } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'ADMIN_ORDER_STATUS_UPDATED', entityType: 'CustomerOrder', entityId: id, before: { status: current.status }, after: { status: updated.status } } });
    return updated;
  }

  private async getOrCreateAgriOrganization() {
    const existing = await this.prisma.organization.findFirst({ where: { type: OrganizationType.AGRI_ONE } });
    if (existing) return existing;
    return this.prisma.organization.create({ data: { name: 'Agri-One', type: OrganizationType.AGRI_ONE, verificationStatus: VerificationStatus.APPROVED } });
  }

  private auditEvent(actorId: string, action: string, entityType: string, entityId: string, after: Prisma.InputJsonValue) {
    return this.prisma.auditEvent.create({ data: { actorId, action, entityType, entityId, after } });
  }
}

function slugify(value: string) { return value.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
