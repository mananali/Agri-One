import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { AdminCatalogStatusDto, AdminListQueryDto, AdminNamedRecordDto, AdminNotificationDto, AdminOfferDto, AdminOrganizationsQueryDto, AdminOrderStatusDto, AdminPaymentStatusDto, AdminPermissionsDto, AdminProductDto, AdminPromotionDto, AdminSettingDto, AdminShipmentStatusDto, AdminUserStatusDto, MobileHomeTopSellingDto, ReviewCertificateApplicationDto, ReviewKycDocumentDto, ReviewOrganizationDto, ReviewProductDto, ReviewReturnRequestDto } from './admin.dto';
import { AdminService } from './admin.service';
import { UpdateShopDetailsDto } from '../auth/shop-details.dto';

const HOME_CATEGORY_CARD_SLUGS = ['fertilizers', 'seeds', 'pesticides', 'equipment'];

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('access') access(@Req() req: AuthenticatedRequest) { return this.admin.adminAccess(req.user.sub); }
  @Get('overview') overview() { return this.admin.overview(); }
  @Get('organizations') organizations(@Query() query: AdminOrganizationsQueryDto) { return this.admin.organizations(query); }
  @Patch('organizations/:id/shop-details') updateOrganizationShopDetails(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateShopDetailsDto) { return this.admin.updateOrganizationShopDetails(req.user.sub, id, dto); }
  @Patch('organizations/:id/verification') verifyOrganization(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ReviewOrganizationDto) { return this.admin.reviewOrganization(req.user.sub, id, dto); }
  @Get('organizations/:organizationId/documents/:documentId/file') async complianceDocumentFile(@Param('organizationId') organizationId: string, @Param('documentId') documentId: string, @Res() response: Response) { const file = await this.admin.complianceDocumentFile(organizationId, documentId); response.setHeader('Cache-Control', 'private, no-store'); response.type(file.mimeType); response.download(file.path, file.originalName); }
  @Patch('organizations/:organizationId/documents/:documentId/review') reviewComplianceDocument(@Req() req: AuthenticatedRequest, @Param('organizationId') organizationId: string, @Param('documentId') documentId: string, @Body() dto: ReviewKycDocumentDto) { return this.admin.reviewComplianceDocument(req.user.sub, organizationId, documentId, dto); }
  @Patch('organizations/:organizationId/certificate-applications/:applicationId/review') reviewCertificateApplication(@Req() req: AuthenticatedRequest, @Param('organizationId') organizationId: string, @Param('applicationId') applicationId: string, @Body() dto: ReviewCertificateApplicationDto) { return this.admin.reviewCertificateApplication(req.user.sub, organizationId, applicationId, dto); }
  @Patch('orders/:orderNumber/returns/:returnId/review') reviewOrderReturn(@Req() req: AuthenticatedRequest, @Param('orderNumber') orderNumber: string, @Param('returnId') returnId: string, @Body() dto: ReviewReturnRequestDto) { return this.admin.reviewReturnRequest(req.user.sub, orderNumber, returnId, dto); }
  @Get('products/pending') pendingProducts(@Query('page') page?: string) { return this.admin.pendingProducts(page ? Number(page) : 1); }
  @Get('products') products(@Query() query: AdminListQueryDto) { return this.admin.listProducts(query); }
  @Post('products') createProduct(@Req() req: AuthenticatedRequest, @Body() dto: AdminProductDto) { return this.admin.createProduct(req.user.sub, dto); }
  @Patch('products/:id') updateProduct(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminProductDto) { return this.admin.updateProduct(req.user.sub, id, dto); }
  @Patch('products/:id/archive') archiveProduct(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.admin.archiveProduct(req.user.sub, id); }
  @Patch('offers/:id') updateOffer(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminOfferDto) { return this.admin.updateOffer(req.user.sub, id, dto); }
  @Patch('products/:id/review') reviewProduct(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ReviewProductDto) { return this.admin.reviewProduct(req.user.sub, id, dto); }
  @Post('products/image') @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)) }))
  async uploadProductImage(@UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }) {
    if (!file) throw new BadRequestException('Choose a JPG, PNG, WebP, or AVIF image under 5 MB');
    const extension = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' } as Record<string, string>)[file.mimetype];
    if (!extension) throw new BadRequestException('Unsupported image type');
    const directory = join(process.cwd(), 'uploads', 'products');
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(directory, filename), file.buffer, { flag: 'wx' });
    return { imageUrl: `/uploads/products/${filename}` };
  }
  @Get('users') users(@Query() query: AdminListQueryDto) { return this.admin.users(query); }
  @Get('users/:id') userAccountDetail(@Param('id') id: string) { return this.admin.userAccountDetail(id); }
  @Patch('users/:id/status') setUserStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminUserStatusDto) { return this.admin.setUserStatus(req.user.sub, id, dto); }
  @Patch('users/:id/permissions') setUserPermissions(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminPermissionsDto) { return this.admin.setUserPermissions(req.user.sub, id, dto); }
  @Get('orders') orders(@Query() query: AdminListQueryDto) { return this.admin.orders(query); }
  @Patch('orders/:id/status') setOrderStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminOrderStatusDto) { return this.admin.setOrderStatus(req.user.sub, id, dto); }
  @Get('catalog-structure') catalogStructure() { return this.admin.organizationsListRecords(); }
  @Get('home-category-cards') homeCategoryCards() { return this.admin.homeCategoryCards(); }
  @Post('home-category-cards/:slug/image') @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)) }))
  async uploadHomeCategoryCardImage(@Req() req: AuthenticatedRequest, @Param('slug') slug: string, @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }) {
    if (!HOME_CATEGORY_CARD_SLUGS.includes(slug)) throw new BadRequestException('Unknown home category card');
    if (!file) throw new BadRequestException('Choose a JPG, PNG, WebP, or AVIF image under 5 MB');
    const extension = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' } as Record<string, string>)[file.mimetype];
    if (!extension) throw new BadRequestException('Unsupported image type');
    const directory = join(process.cwd(), 'uploads', 'category-cards');
    await mkdir(directory, { recursive: true });
    const filename = `${slug}-${randomUUID()}${extension}`;
    await writeFile(join(directory, filename), file.buffer, { flag: 'wx' });
    return this.admin.saveHomeCategoryCardImage(req.user.sub, slug, `/uploads/category-cards/${filename}`);
  }
  @Post('categories') createCategory(@Req() req: AuthenticatedRequest, @Body() dto: AdminNamedRecordDto) { return this.admin.createCategory(req.user.sub, dto); }
  @Patch('categories/:id/status') setCategoryStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminCatalogStatusDto) { return this.admin.setCatalogStatus(req.user.sub, 'category', id, dto.isActive); }
  @Post('brands') createBrand(@Req() req: AuthenticatedRequest, @Body() dto: AdminNamedRecordDto) { return this.admin.createBrand(req.user.sub, dto); }
  @Patch('brands/:id') updateBrand(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminNamedRecordDto) { return this.admin.updateBrand(req.user.sub, id, dto); }
  @Post('brands/image') @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)) }))
  async uploadBrandImage(@UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }) {
    if (!file) throw new BadRequestException('Choose a JPG, PNG, WebP, or AVIF image under 5 MB');
    const extension = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' } as Record<string, string>)[file.mimetype];
    if (!extension) throw new BadRequestException('Unsupported image type');
    const directory = join(process.cwd(), 'uploads', 'brands');
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(directory, filename), file.buffer, { flag: 'wx' });
    return { imageUrl: `/uploads/brands/${filename}` };
  }
  @Patch('brands/:id/status') setBrandStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminCatalogStatusDto) { return this.admin.setCatalogStatus(req.user.sub, 'brand', id, dto.isActive); }
  @Get('inventory') inventory() { return this.admin.inventory(); }
  @Get('deliveries') deliveries() { return this.admin.deliveries(); }
  @Patch('deliveries/:id/status') setDeliveryStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminShipmentStatusDto) { return this.admin.setDeliveryStatus(req.user.sub, id, dto); }
  @Get('ledger') ledger() { return this.admin.ledger(); }
  @Patch('payments/:id/status') setPaymentStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminPaymentStatusDto) { return this.admin.setPaymentStatus(req.user.sub, id, dto); }
  @Get('reports') reports() { return this.admin.reports(); }
  @Get('notifications') notifications() { return this.admin.notifications(); }
  @Post('notifications') createNotification(@Req() req: AuthenticatedRequest, @Body() dto: AdminNotificationDto) { return this.admin.createNotification(req.user.sub, dto); }
  @Patch('notifications/:id/status') setNotificationStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminCatalogStatusDto) { return this.admin.setNotificationStatus(req.user.sub, id, dto.isActive); }
  @Get('settings') settings() { return this.admin.settings(); }
  @Put('settings/:key') updateSetting(@Req() req: AuthenticatedRequest, @Param('key') key: string, @Body() dto: AdminSettingDto) { return this.admin.updateSetting(req.user.sub, key, dto.value); }
  @Put('mobile-home/top-selling') saveMobileHomeTopSelling(@Req() req: AuthenticatedRequest, @Body() dto: MobileHomeTopSellingDto) { return this.admin.updateSetting(req.user.sub, 'mobile.home.top-selling', { enabled: dto.enabled, title: dto.title, subtitle: dto.subtitle, productIds: dto.productIds }); }
  @Get('promotions') promotions() { return this.admin.promotions(true); }
  @Post('promotions') createPromotion(@Req() req: AuthenticatedRequest, @Body() dto: AdminPromotionDto) { return this.admin.createPromotion(req.user.sub, dto); }
  @Patch('promotions/:id/status') setPromotionStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminCatalogStatusDto) { return this.admin.setPromotionStatus(req.user.sub, id, dto.isActive); }
}
