import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { AdminCatalogStatusDto, AdminListQueryDto, AdminNamedRecordDto, AdminOfferDto, AdminOrganizationsQueryDto, AdminOrderStatusDto, AdminProductDto, AdminUserStatusDto, ReviewOrganizationDto, ReviewProductDto } from './admin.dto';
import { AdminService } from './admin.service';

const HOME_CATEGORY_CARD_SLUGS = ['fertilizers', 'seeds', 'pesticides', 'equipment'];

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('overview') overview() { return this.admin.overview(); }
  @Get('organizations') organizations(@Query() query: AdminOrganizationsQueryDto) { return this.admin.organizations(query); }
  @Patch('organizations/:id/verification') verifyOrganization(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ReviewOrganizationDto) { return this.admin.reviewOrganization(req.user.sub, id, dto); }
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
  @Patch('users/:id/status') setUserStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminUserStatusDto) { return this.admin.setUserStatus(req.user.sub, id, dto); }
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
}
