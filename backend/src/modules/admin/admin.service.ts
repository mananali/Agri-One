import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, CertificateApplicationStatus, FinancialTransactionType, FulfillmentSource, FulfillmentStatus, InventoryMovementType, NotificationAudience, OrderStatus, OrganizationType, PaymentStatus, ProductStatus, ReturnRequestStatus, ShipmentStatus, UserRole, VerificationStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminListQueryDto, AdminNamedRecordDto, AdminNotificationDto, AdminOfferDto, AdminOrganizationsQueryDto, AdminOrderStatusDto, AdminPaymentStatusDto, AdminPermissionsDto, AdminProductDto, AdminPromotionDto, AdminSettingDto, AdminShipmentStatusDto, AdminUserStatusDto, ReviewCertificateApplicationDto, ReviewKycDocumentDto, ReviewOrganizationDto, ReviewProductDto, ReviewReturnRequestDto } from './admin.dto';
import { UpdateShopDetailsDto } from '../auth/shop-details.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  adminAccess(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { isSuperAdmin: true, adminPermissions: true } });
  }

  async overview() {
    const [users, retailers, suppliers, products, pendingProducts, orders, pendingOrganizations, revenue] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.organization.count({ where: { type: OrganizationType.RETAILER } }),
      this.prisma.organization.count({ where: { type: OrganizationType.SUPPLIER } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: ProductStatus.PENDING_REVIEW } }),
      this.prisma.customerOrder.count(),
      this.prisma.organization.count({ where: { verificationStatus: VerificationStatus.PENDING, type: { in: [OrganizationType.RETAILER, OrganizationType.SUPPLIER] } } }),
      this.prisma.customerOrder.aggregate({ _sum: { total: true }, where: { status: OrderStatus.DELIVERED, returnRequests: { none: { status: ReturnRequestStatus.COMPLETED } } } }),
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

  async updateOrganizationShopDetails(actorId: string, id: string, dto: UpdateShopDetailsDto) {
    const current = await this.prisma.organization.findUnique({ where: { id }, select: { id: true, type: true, name: true, shopPinCode: true, shopCity: true, shopDistrict: true, shopState: true, shopNumber: true, shopArea: true, shopLandmark: true } });
    if (!current || current.type !== OrganizationType.RETAILER) throw new NotFoundException('Retailer organization not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({ where: { id }, data: {
        name: dto.shopName.trim(), shopPinCode: dto.pinCode.trim(), shopCity: dto.city.trim(), shopDistrict: dto.district.trim(), shopState: dto.state.trim(), shopNumber: dto.shopNumber.trim(), shopArea: dto.area.trim(), shopLandmark: dto.landmark?.trim() || null,
      } });
      await tx.auditEvent.create({ data: { actorId, action: 'VERIFIED_SHOP_DETAILS_UPDATED', entityType: 'Organization', entityId: id, before: current, after: { name: updated.name, shopPinCode: updated.shopPinCode, shopCity: updated.shopCity, shopDistrict: updated.shopDistrict, shopState: updated.shopState, shopNumber: updated.shopNumber, shopArea: updated.shopArea, shopLandmark: updated.shopLandmark } } });
      return { id, shopName: updated.name, pinCode: updated.shopPinCode, city: updated.shopCity, district: updated.shopDistrict, state: updated.shopState, shopNumber: updated.shopNumber, area: updated.shopArea, landmark: updated.shopLandmark, verificationStatus: updated.verificationStatus };
    });
  }

  async reviewComplianceDocument(actorId: string, organizationId: string, documentId: string, dto: ReviewKycDocumentDto) {
    const document = await this.prisma.kycDocument.findFirst({ where: { id: documentId, organizationId } });
    if (!document) throw new NotFoundException('Compliance document not found');
    const updated = await this.prisma.kycDocument.update({ where: { id: documentId }, data: { reviewStatus: dto.status as VerificationStatus, reviewReason: dto.status === 'APPROVED' ? null : dto.reason?.trim() || 'Please contact Agri-One support for review details' }, select: { id: true, organizationId: true, documentType: true, originalName: true, reviewStatus: true, reviewReason: true, createdAt: true } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'COMPLIANCE_DOCUMENT_REVIEWED', entityType: 'KycDocument', entityId: documentId, before: { reviewStatus: document.reviewStatus }, after: { reviewStatus: updated.reviewStatus, reviewReason: updated.reviewReason } } });
    return updated;
  }

  async complianceDocumentFile(organizationId: string, documentId: string) {
    const document = await this.prisma.kycDocument.findFirst({ where: { id: documentId, organizationId }, select: { storageKey: true, originalName: true, mimeType: true } });
    if (!document) throw new NotFoundException('Compliance document not found');
    const path = join(process.cwd(), 'private-uploads', 'compliance', document.storageKey);
    try { await access(path); } catch { throw new NotFoundException('Compliance document file is unavailable'); }
    return { path, originalName: basename(document.originalName), mimeType: document.mimeType };
  }

  async reviewCertificateApplication(actorId: string, organizationId: string, applicationId: string, dto: ReviewCertificateApplicationDto) {
    const application = await this.prisma.certificateApplication.findFirst({ where: { id: applicationId, organizationId } });
    if (!application) throw new NotFoundException('Certificate application not found');
    const updated = await this.prisma.certificateApplication.update({ where: { id: applicationId }, data: { status: dto.status as CertificateApplicationStatus, reviewReason: dto.status === 'APPROVED' ? null : dto.reason?.trim() || 'Please contact Agri-One support for review details' } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'CERTIFICATE_APPLICATION_REVIEWED', entityType: 'CertificateApplication', entityId: applicationId, before: { status: application.status }, after: { status: updated.status, reviewReason: updated.reviewReason } } });
    return updated;
  }

  async reviewReturnRequest(actorId: string, orderNumber: string, returnId: string, dto: ReviewReturnRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.orderReturnRequest.findFirst({ where: { id: returnId, customerOrder: { orderNumber } }, include: { customerOrder: { include: { fulfillments: { include: { lines: true } } } } } });
      if (!request) throw new NotFoundException('Return request not found');
      if (request.status === ReturnRequestStatus.COMPLETED || request.status === ReturnRequestStatus.REJECTED) throw new ConflictException('This return request is already closed');
      if (request.status === ReturnRequestStatus.APPROVED && dto.status !== 'COMPLETED') throw new ConflictException('An approved return can only be completed');
      if (request.status === ReturnRequestStatus.REQUESTED && dto.status === 'COMPLETED') throw new BadRequestException('Approve the return before completing it');
      const status = dto.status as ReturnRequestStatus;
      if (status === ReturnRequestStatus.COMPLETED) {
        for (const fulfillment of request.customerOrder.fulfillments) for (const line of fulfillment.lines) {
          await tx.productOffer.update({ where: { id: line.offerId }, data: { stockOnHand: { increment: line.quantity } } });
          await tx.inventoryMovement.create({ data: { offerId: line.offerId, actorId, type: InventoryMovementType.RETURN, quantity: line.quantity, reason: `Accepted return ${request.customerOrder.orderNumber}`, referenceId: returnId } });
        }
      }
      const updated = await tx.orderReturnRequest.update({ where: { id: returnId }, data: { status, reviewReason: status === ReturnRequestStatus.APPROVED || status === ReturnRequestStatus.COMPLETED ? null : dto.reviewReason?.trim() || 'Please contact Agri-One support for details', reviewedAt: new Date() } });
      await tx.auditEvent.create({ data: { actorId, action: 'ORDER_RETURN_REVIEWED', entityType: 'OrderReturnRequest', entityId: returnId, before: { status: request.status }, after: { status: updated.status, reviewReason: updated.reviewReason, restocked: status === ReturnRequestStatus.COMPLETED } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listProducts(query: AdminListQueryDto) {
    const where: Prisma.ProductWhereInput = {
      ...(query.status ? { status: query.status as ProductStatus } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search, mode: 'insensitive' } }, { brand: { name: { contains: query.search, mode: 'insensitive' } } }] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, include: { category: { select: { id: true, name: true, slug: true } }, brand: { select: { id: true, name: true, slug: true } }, offers: { include: { seller: { select: { id: true, name: true, type: true } }, serviceAreas: { select: { pinCode: true } } }, orderBy: { createdAt: 'asc' } } }, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.product.count({ where }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async createProduct(actorId: string, dto: AdminProductDto) {
    const [category, brand] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: dto.categoryId } }),
      dto.brandId ? this.prisma.brand.findUnique({ where: { id: dto.brandId } }) : Promise.resolve(null),
    ]);
    if (!category?.isActive) throw new BadRequestException('Choose an active product category');
    if (dto.brandId && !brand) throw new BadRequestException('Choose an existing brand');
    const organization = await this.getOrCreateAgriOrganization();
    const baseSlug = slugify(dto.name).slice(0, 80) || 'product';
    const status = (dto.status ?? 'APPROVED') as ProductStatus;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: dto.name.trim(), slug: `${baseSlug}-${randomUUID().slice(0, 6)}`, categoryId: category.id, brandId: brand?.id ?? null,
            description: dto.description?.trim() || null, imageUrl: dto.imageUrl || null, packSize: dto.packSize.trim(), unit: dto.unit.trim(), taxRate: dto.taxRate, status,
            offers: { create: { sellerOrganizationId: organization.id, source: FulfillmentSource.AGRI_ONE_STOCK, sellerSku: dto.sellerSku.trim(), price: dto.price, mrp: dto.mrp ?? dto.price, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.stockOnHand, isActive: status === ProductStatus.APPROVED, serviceAreas: { create: dto.servicePinCodes.map((pinCode) => ({ pinCode })) } } },
          },
          include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } }, offers: true },
        });
        if (dto.stockOnHand > 0 && product.offers[0]) await tx.inventoryMovement.create({ data: { offerId: product.offers[0].id, actorId, type: InventoryMovementType.RECEIPT, quantity: dto.stockOnHand, reason: 'Initial Agri-One inventory' } });
        await tx.auditEvent.create({ data: { actorId, action: 'ADMIN_PRODUCT_CREATED', entityType: 'Product', entityId: product.id, after: { name: product.name, status, imageUrl: product.imageUrl } } });
        return product;
      });
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
    if (!category?.isActive) throw new BadRequestException('Choose an active product category');
    if (dto.brandId && !brand) throw new BadRequestException('Choose an existing brand');
    const status = (dto.status ?? current.status) as ProductStatus;
    const active = status === ProductStatus.APPROVED;
    const offer = current.offers[0];
    if (offer && dto.stockOnHand < offer.reservedQuantity) throw new BadRequestException('Stock cannot be set below the quantity reserved for open orders');
    const updated = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({ where: { id }, data: { name: dto.name.trim(), categoryId: category.id, brandId: brand?.id ?? null, description: dto.description?.trim() || null, imageUrl: dto.imageUrl || null, packSize: dto.packSize.trim(), unit: dto.unit.trim(), taxRate: dto.taxRate, status, rejectionReason: null } });
      if (offer) {
        const offerChanged = await tx.productOffer.updateMany({ where: { id: offer.id, stockOnHand: offer.stockOnHand, reservedQuantity: { lte: dto.stockOnHand } }, data: { sellerSku: dto.sellerSku.trim(), price: dto.price, mrp: dto.mrp ?? dto.price, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.stockOnHand, isActive: active } });
        if (offerChanged.count !== 1) throw new ConflictException('Inventory changed while saving this product; refresh and retry');
        const stockDelta = dto.stockOnHand - offer.stockOnHand;
        if (stockDelta !== 0) await tx.inventoryMovement.create({ data: { offerId: offer.id, actorId, type: InventoryMovementType.ADJUSTMENT, quantity: stockDelta, reason: 'Admin product details updated' } });
        await tx.offerServiceArea.deleteMany({ where: { offerId: offer.id } });
        await tx.offerServiceArea.createMany({ data: dto.servicePinCodes.map((pinCode) => ({ offerId: offer.id, pinCode })) });
      }
      else {
        const organization = await tx.organization.findFirst({ where: { type: OrganizationType.AGRI_ONE } });
        if (!organization) throw new NotFoundException('Agri-One stock organization is missing');
        await tx.productOffer.create({ data: { productId: id, sellerOrganizationId: organization.id, source: FulfillmentSource.AGRI_ONE_STOCK, sellerSku: dto.sellerSku.trim(), price: dto.price, mrp: dto.mrp ?? dto.price, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.stockOnHand, isActive: active, serviceAreas: { create: dto.servicePinCodes.map((pinCode) => ({ pinCode })) } } });
      }
      await tx.productOffer.updateMany({ where: { productId: id, source: FulfillmentSource.MARKETPLACE, ...(active ? { seller: { verificationStatus: VerificationStatus.APPROVED } } : {}) }, data: { isActive: active } });
      await tx.auditEvent.create({ data: { actorId, action: 'ADMIN_PRODUCT_UPDATED', entityType: 'Product', entityId: id, before: { status: current.status, imageUrl: current.imageUrl }, after: { status, imageUrl: product.imageUrl } } });
      return tx.product.findUniqueOrThrow({ where: { id }, include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } }, offers: { include: { seller: { select: { id: true, name: true, type: true } }, serviceAreas: { select: { pinCode: true } } } } } });
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
      const changed = await tx.productOffer.updateMany({ where: { id, stockOnHand: current.stockOnHand, reservedQuantity: { lte: dto.stockOnHand } }, data: { price: dto.price, mrp: dto.mrp, minimumOrderQuantity: dto.minimumOrderQuantity, stockOnHand: dto.stockOnHand, commissionRate: dto.commissionRate, isActive: dto.isActive } });
      if (changed.count !== 1) throw new ConflictException('Inventory changed while saving this offer; refresh and retry');
      const updated = await tx.productOffer.findUniqueOrThrow({ where: { id } });
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
      this.prisma.user.findMany({ where, select: { id: true, name: true, email: true, phone: true, role: true, status: true, adminPermissions: true, isSuperAdmin: true, createdAt: true, organization: { select: { id: true, name: true, type: true, verificationStatus: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.user.count({ where }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async userAccountDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, role: true, status: true,
        emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true, organization: {
          select: {
            id: true, name: true, type: true, businessEntityType: true,
            verificationStatus: true, verificationReason: true, email: true, phone: true,
            gstin: true, shopPinCode: true, shopCity: true, shopDistrict: true,
            shopState: true, shopNumber: true, shopArea: true, shopLandmark: true,
            deliveryAddresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
            kycDocuments: { orderBy: { createdAt: 'desc' }, select: {
              id: true, documentType: true, originalName: true, mimeType: true,
              reviewStatus: true, reviewReason: true, createdAt: true,
            } },
            certificateApplications: { orderBy: { createdAt: 'desc' } },
            wallet: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 100 } } },
            retailerOrders: {
              orderBy: { createdAt: 'desc' }, take: 100,
              include: { fulfillments: { include: { lines: true, shipment: true, seller: { select: { name: true } } } }, returnRequests: { orderBy: { requestedAt: 'desc' } } },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setUserStatus(actorId: string, targetId: string, dto: AdminUserStatusDto) {
    const [current, actor] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true, status: true, role: true, name: true, isSuperAdmin: true } }),
      this.prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } }),
    ]);
    if (!current) throw new NotFoundException('User not found');
    if (current.isSuperAdmin && !actor?.isSuperAdmin) throw new ForbiddenException('Only a super admin can change a super admin account');
    if (actorId === targetId && dto.status === 'DISABLED') throw new ForbiddenException('You cannot disable your own admin account');
    const updated = await this.prisma.user.update({ where: { id: targetId }, data: { status: dto.status as AccountStatus }, select: { id: true, name: true, role: true, status: true } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'USER_STATUS_UPDATED', entityType: 'User', entityId: targetId, before: { status: current.status }, after: { status: updated.status } } });
    return updated;
  }

  async setUserPermissions(actorId: string, targetId: string, dto: AdminPermissionsDto) {
    if (actorId === targetId) throw new ForbiddenException('You cannot change your own admin permissions');
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
    if (!actor?.isSuperAdmin) throw new ForbiddenException('Only a super admin can assign admin permissions');
    const current = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, adminPermissions: true } });
    if (!current || current.role !== UserRole.ADMIN) throw new NotFoundException('Admin account not found');
    const permissions = dto.permissions as import('@prisma/client').AdminPermission[];
    const updated = await this.prisma.user.update({ where: { id: targetId }, data: { adminPermissions: permissions, isSuperAdmin: false }, select: { id: true, name: true, adminPermissions: true, isSuperAdmin: true } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'ADMIN_PERMISSIONS_UPDATED', entityType: 'User', entityId: targetId, before: { permissions: current.adminPermissions }, after: { permissions } } });
    return updated;
  }

  async orders(query: AdminListQueryDto) {
    const where: Prisma.CustomerOrderWhereInput = {
      ...(query.status ? { status: query.status as OrderStatus } : {}),
      ...(query.search ? { OR: [{ orderNumber: { contains: query.search, mode: 'insensitive' } }, { retailer: { name: { contains: query.search, mode: 'insensitive' } } }, { deliveryName: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customerOrder.findMany({ where, include: { retailer: { select: { id: true, name: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 1 }, returnRequests: { orderBy: { requestedAt: 'desc' } }, fulfillments: { include: { seller: { select: { id: true, name: true } }, lines: true, shipment: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.customerOrder.count({ where }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async setOrderStatus(actorId: string, id: string, dto: AdminOrderStatusDto) {
    const current = await this.prisma.customerOrder.findUnique({ where: { id }, include: { fulfillments: { include: { lines: true, shipment: true } } } });
    if (!current) throw new NotFoundException('Order not found');
    const target = dto.status as OrderStatus;
    if (target === current.status) return { id, orderNumber: current.orderNumber, status: current.status };
    if (target === OrderStatus.ACCEPTED && (current.status === OrderStatus.PLACED || current.status === OrderStatus.PARTIALLY_ACCEPTED)) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.customerOrder.update({ where: { id }, data: { status: OrderStatus.ACCEPTED }, select: { id: true, orderNumber: true, status: true } });
        await tx.auditEvent.create({ data: { actorId, action: 'ADMIN_ORDER_ACCEPTED', entityType: 'CustomerOrder', entityId: id, before: { status: current.status }, after: { status: updated.status } } });
        return updated;
      });
    }
    if (target !== OrderStatus.CANCELLED && target !== OrderStatus.REJECTED) throw new BadRequestException('Order status is controlled by acceptance, fulfillment and delivery workflows');
    if (current.status === OrderStatus.CANCELLED || current.status === OrderStatus.REJECTED) return { id, orderNumber: current.orderNumber, status: current.status };
    if (current.fulfillments.some((item) => item.status === FulfillmentStatus.DISPATCHED || item.status === FulfillmentStatus.DELIVERED || (item.shipment && item.shipment.status !== ShipmentStatus.READY_FOR_PICKUP))) throw new ConflictException('An order cannot be cancelled after it has entered delivery');
    return this.prisma.$transaction(async (tx) => {
      for (const fulfillment of current.fulfillments) {
        if (fulfillment.status === FulfillmentStatus.CANCELLED || fulfillment.status === FulfillmentStatus.REJECTED) continue;
        for (const line of fulfillment.lines) {
          const released = await tx.productOffer.updateMany({ where: { id: line.offerId, reservedQuantity: { gte: line.quantity } }, data: { reservedQuantity: { decrement: line.quantity } } });
          if (released.count !== 1) throw new ConflictException('Reserved stock could not be released; review this order before retrying');
          await tx.inventoryMovement.create({ data: { offerId: line.offerId, actorId, type: InventoryMovementType.RELEASE, quantity: line.quantity, reason: `Order ${target.toLowerCase()}`, referenceId: fulfillment.id } });
        }
        await tx.fulfillmentOrder.update({ where: { id: fulfillment.id }, data: { status: FulfillmentStatus.CANCELLED, rejectionReason: target === OrderStatus.REJECTED ? 'Rejected by admin' : null } });
      }
      await tx.payment.updateMany({ where: { customerOrderId: id, status: PaymentStatus.PENDING }, data: { status: PaymentStatus.FAILED } });
      const updated = await tx.customerOrder.update({ where: { id }, data: { status: target }, select: { id: true, orderNumber: true, status: true } });
      await tx.auditEvent.create({ data: { actorId, action: target === OrderStatus.REJECTED ? 'ADMIN_ORDER_REJECTED' : 'ADMIN_ORDER_CANCELLED', entityType: 'CustomerOrder', entityId: id, before: { status: current.status }, after: { status: updated.status } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  inventory() {
    return this.prisma.productOffer.findMany({
      where: { product: { status: { not: ProductStatus.ARCHIVED } } },
      include: { product: { select: { id: true, name: true, slug: true, imageUrl: true, category: { select: { name: true } } } }, seller: { select: { id: true, name: true, type: true } }, movements: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: [{ stockOnHand: 'asc' }, { updatedAt: 'desc' }], take: 200,
    });
  }

  deliveries() {
    return this.prisma.shipment.findMany({
      include: { carrier: { select: { id: true, name: true } }, assignedUser: { select: { id: true, name: true } }, events: { orderBy: { occurredAt: 'desc' }, take: 5 }, fulfillmentOrder: { include: { customerOrder: { select: { id: true, orderNumber: true, deliveryName: true, deliveryPhone: true, deliveryAddress: true, deliveryDistrict: true, deliveryPinCode: true } }, seller: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' }, take: 200,
    });
  }

  async setDeliveryStatus(actorId: string, id: string, dto: AdminShipmentStatusDto) {
    const current = await this.prisma.shipment.findUnique({ where: { id }, include: { fulfillmentOrder: { include: { lines: true, customerOrder: { select: { id: true, orderNumber: true, retailerId: true, rewardPoints: true, paymentMethod: true, status: true } } } } } });
    if (!current) throw new NotFoundException('Delivery record not found');
    const nextStatus = dto.status as ShipmentStatus;
    if (nextStatus === current.status) return current;
    const allowedNext: Record<ShipmentStatus, ShipmentStatus[]> = {
      READY_FOR_PICKUP: [ShipmentStatus.PICKED_UP],
      PICKED_UP: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.RETURNING],
      IN_TRANSIT: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.RETURNING],
      OUT_FOR_DELIVERY: [ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERY_FAILED, ShipmentStatus.RETURNING],
      DELIVERY_FAILED: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.RETURNING],
      RETURNING: [ShipmentStatus.RETURNED],
      DELIVERED: [],
      RETURNED: [],
    };
    if (!allowedNext[current.status].includes(nextStatus)) throw new ConflictException(`Delivery cannot move from ${current.status} to ${nextStatus}`);
    if (nextStatus === ShipmentStatus.PICKED_UP && current.fulfillmentOrder.source === FulfillmentSource.MARKETPLACE && current.fulfillmentOrder.status !== FulfillmentStatus.ACCEPTED && current.fulfillmentOrder.status !== FulfillmentStatus.PICKING) throw new ConflictException('The supplier must accept this fulfillment before it can be picked up');
    if (nextStatus === ShipmentStatus.PICKED_UP && current.fulfillmentOrder.source === FulfillmentSource.AGRI_ONE_STOCK && current.fulfillmentOrder.customerOrder.status !== OrderStatus.ACCEPTED) throw new ConflictException('Confirm this Agri-One order before dispatch');
    return this.prisma.$transaction(async (tx) => {
      const status = nextStatus;
      const claimed = await tx.shipment.updateMany({ where: { id, status: current.status }, data: { status, trackingNumber: dto.trackingNumber?.trim() || current.trackingNumber, failureReason: status === ShipmentStatus.DELIVERY_FAILED ? dto.failureReason?.trim() || 'Delivery failed' : null, deliveredAt: status === ShipmentStatus.DELIVERED ? new Date() : undefined } });
      if (claimed.count !== 1) throw new ConflictException('Shipment status changed while saving; refresh and retry');
      const updated = await tx.shipment.findUniqueOrThrow({ where: { id } });
      await tx.shipmentEvent.create({ data: { shipmentId: id, status, note: dto.note?.trim() || null } });
      if (status === ShipmentStatus.DELIVERED && current.status !== ShipmentStatus.DELIVERED) {
        for (const line of current.fulfillmentOrder.lines) {
          const reserved = await tx.productOffer.updateMany({ where: { id: line.offerId, reservedQuantity: { gte: line.quantity }, stockOnHand: { gte: line.quantity } }, data: { reservedQuantity: { decrement: line.quantity }, stockOnHand: { decrement: line.quantity } } });
          if (reserved.count !== 1) throw new ConflictException('Reserved stock could not be finalized; review this delivery before retrying');
          await tx.inventoryMovement.create({ data: { offerId: line.offerId, actorId, type: InventoryMovementType.DISPATCH, quantity: line.quantity, reason: 'COD delivery completed', referenceId: current.fulfillmentOrderId } });
        }
        await tx.fulfillmentOrder.update({ where: { id: current.fulfillmentOrderId }, data: { status: FulfillmentStatus.DELIVERED } });
        const sibling = await tx.fulfillmentOrder.findMany({ where: { customerOrderId: current.fulfillmentOrder.customerOrder.id }, select: { status: true } });
        const allDelivered = sibling.every((item) => item.status === FulfillmentStatus.DELIVERED);
        const someDelivered = sibling.some((item) => item.status === FulfillmentStatus.DELIVERED);
        await tx.customerOrder.update({ where: { id: current.fulfillmentOrder.customerOrder.id }, data: { status: allDelivered ? OrderStatus.DELIVERED : someDelivered ? OrderStatus.PARTIALLY_DISPATCHED : OrderStatus.DISPATCHED } });
        if (allDelivered && current.fulfillmentOrder.customerOrder.paymentMethod === 'COD') {
          const pendingCod = await tx.payment.findMany({ where: { customerOrderId: current.fulfillmentOrder.customerOrder.id, provider: 'CASH_ON_DELIVERY', status: PaymentStatus.PENDING }, select: { amount: true } });
          if (pendingCod.length) {
            const collectedAmount = pendingCod.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
            const cashAccount = await tx.cashBankAccount.findFirst({ where: { type: 'CASH', name: 'Cash on Hand', isActive: true } }) ?? await tx.cashBankAccount.create({ data: { name: 'Cash on Hand', type: 'CASH' } });
            const collectionKey = `cod-delivery:${current.fulfillmentOrder.customerOrder.id}`;
            await tx.cashBankAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: { increment: collectedAmount } } });
            await tx.financialTransaction.create({ data: { idempotencyKey: collectionKey, type: FinancialTransactionType.RETAILER_RECEIPT, amount: collectedAmount, accountId: cashAccount.id, partyOrganizationId: current.fulfillmentOrder.customerOrder.retailerId, customerOrderId: current.fulfillmentOrder.customerOrder.id, reference: current.fulfillmentOrder.customerOrder.orderNumber, note: 'Cash on delivery collected', actorId } });
            await tx.payment.updateMany({ where: { customerOrderId: current.fulfillmentOrder.customerOrder.id, provider: 'CASH_ON_DELIVERY', status: PaymentStatus.PENDING }, data: { status: PaymentStatus.PAID, providerReference: `COD-COLLECTED-${current.fulfillmentOrder.customerOrder.id}` } });
          }
        }
        if (allDelivered && current.fulfillmentOrder.customerOrder.rewardPoints > 0) {
          const order = current.fulfillmentOrder.customerOrder;
          const wallet = await tx.wallet.upsert({ where: { organizationId: order.retailerId }, create: { organizationId: order.retailerId, coinBalance: order.rewardPoints }, update: { coinBalance: { increment: order.rewardPoints } } });
          await tx.walletTransaction.create({ data: { walletId: wallet.id, type: 'CREDIT', coinDelta: order.rewardPoints, description: `Reward points for delivered order ${order.orderNumber}`, reference: order.id } });
        }
      }
      await tx.auditEvent.create({ data: { actorId, action: 'ADMIN_DELIVERY_STATUS_UPDATED', entityType: 'Shipment', entityId: id, before: { status: current.status, trackingNumber: current.trackingNumber }, after: { status, trackingNumber: updated.trackingNumber } } });
      return updated;
    });
  }

  async ledger() {
    const [payments, walletTransactions] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ include: { customerOrder: { select: { orderNumber: true, retailer: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.walletTransaction.findMany({ include: { wallet: { include: { organization: { select: { id: true, name: true, type: true } } } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
    ]);
    return { payments, walletTransactions };
  }

  async setPaymentStatus(actorId: string, id: string, dto: AdminPaymentStatusDto) {
    const current = await this.prisma.payment.findUnique({ where: { id }, select: { id: true, status: true, providerReference: true } });
    if (!current) throw new NotFoundException('Payment record not found');
    if (current.status === dto.status) return { id: current.id, status: current.status, providerReference: current.providerReference };
    if (dto.status === PaymentStatus.PAID) throw new BadRequestException('Record retailer payments from Finance & Accounts so the receipt and account ledger stay in sync');
    const permitted: Record<PaymentStatus, PaymentStatus[]> = { PENDING: [PaymentStatus.AUTHORIZED, PaymentStatus.FAILED], AUTHORIZED: [PaymentStatus.FAILED], PAID: [], FAILED: [], PARTIALLY_REFUNDED: [], REFUNDED: [] };
    if (!permitted[current.status].includes(dto.status as PaymentStatus)) throw new ConflictException('Payment status cannot be reversed; use the refund workflow for corrections');
    const updated = await this.prisma.payment.update({ where: { id }, data: { status: dto.status as PaymentStatus, providerReference: dto.providerReference?.trim() || current.providerReference }, select: { id: true, status: true, providerReference: true, amount: true, customerOrderId: true } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'ADMIN_PAYMENT_STATUS_UPDATED', entityType: 'Payment', entityId: id, before: { status: current.status, providerReference: current.providerReference }, after: { status: updated.status, providerReference: updated.providerReference } } });
    return updated;
  }

  async reports() {
    const [orders, orderValues, products, inventory, lowStock, users, paymentTotals] = await this.prisma.$transaction([
      this.prisma.customerOrder.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.customerOrder.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { status: OrderStatus.DELIVERED, returnRequests: { none: { status: ReturnRequestStatus.COMPLETED } } } }),
      this.prisma.product.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.productOffer.aggregate({ _sum: { stockOnHand: true }, _count: { _all: true } }),
      this.prisma.productOffer.count({ where: { isActive: true, stockOnHand: { lte: 5 } } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true }, orderBy: { role: 'asc' } }),
      this.prisma.payment.groupBy({ by: ['status'], _sum: { amount: true }, _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    return { orders, orderValues: { count: orderValues._count._all, revenue: Number(orderValues._sum.total ?? 0) }, products, inventory: { offers: inventory._count._all, unitsOnHand: inventory._sum.stockOnHand ?? 0, lowStockOffers: lowStock }, users, paymentTotals };
  }

  notifications() { return this.prisma.adminNotification.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { createdBy: { select: { name: true } }, _count: { select: { recipients: true } } } }); }

  async createNotification(actorId: string, dto: AdminNotificationDto) {
    return this.prisma.$transaction(async (tx) => {
      const audience = (dto.audience ?? 'ALL') as NotificationAudience;
      const notification = await tx.adminNotification.create({ data: { title: dto.title.trim(), body: dto.body.trim(), audience, createdById: actorId } });
      const roles: UserRole[] = audience === NotificationAudience.RETAILERS ? [UserRole.RETAILER] : audience === NotificationAudience.SUPPLIERS ? [UserRole.SUPPLIER] : audience === NotificationAudience.OPERATIONS ? [UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.DELIVERY, UserRole.FINANCE, UserRole.SUPPORT] : Object.values(UserRole);
      const recipients = await tx.user.findMany({ where: { status: AccountStatus.ACTIVE, role: { in: roles } }, select: { id: true } });
      if (recipients.length) await tx.notificationRecipient.createMany({ data: recipients.map(({ id }) => ({ notificationId: notification.id, userId: id })) });
      await tx.auditEvent.create({ data: { actorId, action: 'ADMIN_NOTIFICATION_CREATED', entityType: 'AdminNotification', entityId: notification.id, after: { title: notification.title, audience, recipients: recipients.length } } });
      return { ...notification, recipientCount: recipients.length };
    });
  }

  async setNotificationStatus(actorId: string, id: string, isActive: boolean) {
    const current = await this.prisma.adminNotification.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!current) throw new NotFoundException('Notification not found');
    const updated = await this.prisma.adminNotification.update({ where: { id }, data: { isActive } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'ADMIN_NOTIFICATION_STATUS_UPDATED', entityType: 'AdminNotification', entityId: id, before: { isActive: current.isActive }, after: { isActive } } });
    return updated;
  }

  settings() { return this.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } }); }

  async updateSetting(actorId: string, key: string, value: AdminSettingDto['value']) {
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(key)) throw new BadRequestException('Setting key must use letters, numbers, dots, underscores, or hyphens');
    const current = await this.prisma.platformSetting.findUnique({ where: { key } });
    const updated = await this.prisma.platformSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue, updatedById: actorId }, update: { value: value as Prisma.InputJsonValue, updatedById: actorId } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'PLATFORM_SETTING_UPDATED', entityType: 'PlatformSetting', entityId: key, before: current ? { value: current.value } : undefined, after: { value: updated.value } } });
    return updated;
  }

  promotions(includeInactive = false) {
    return this.prisma.promotion.findMany({ where: includeInactive ? undefined : { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async createPromotion(actorId: string, dto: AdminPromotionDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('Promotion end time must be after its start time');
    const type = dto.type ?? 'FESTIVAL';
    if (type === 'BULK' && (!dto.minimumOrderQuantity || !dto.discountPercent)) throw new BadRequestException('Bulk promotions require a minimum quantity and a discount percentage');
    if (type === 'REWARDS' && !dto.coinsPer100) throw new BadRequestException('Reward promotions require the points earned per ₹100');
    const promotion = await this.prisma.promotion.create({ data: { title: dto.title.trim(), body: dto.body.trim(), type, discountPercent: dto.discountPercent, minimumOrderQuantity: dto.minimumOrderQuantity, coinsPer100: dto.coinsPer100 ?? 0, startsAt, endsAt, createdById: actorId } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'ADMIN_PROMOTION_CREATED', entityType: 'Promotion', entityId: promotion.id, after: { title: promotion.title, type, startsAt, endsAt, discountPercent: dto.discountPercent, minimumOrderQuantity: dto.minimumOrderQuantity, coinsPer100: dto.coinsPer100 ?? 0 } } });
    return promotion;
  }

  async setPromotionStatus(actorId: string, id: string, isActive: boolean) {
    const current = await this.prisma.promotion.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!current) throw new NotFoundException('Promotion not found');
    const updated = await this.prisma.promotion.update({ where: { id }, data: { isActive } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'ADMIN_PROMOTION_STATUS_UPDATED', entityType: 'Promotion', entityId: id, before: { isActive: current.isActive }, after: { isActive } } });
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
