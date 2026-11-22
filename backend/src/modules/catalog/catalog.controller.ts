import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { AdjustStockDto, CatalogQueryDto, CreateSupplierProductDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get('categories') @Public() categories() { return this.catalog.listCategories(); }
  @Get('home-category-cards') @Public() homeCategoryCards() { return this.catalog.homeCategoryCards(); }
  @Get('brands') @Public() brands() { return this.catalog.listBrands(); }
  @Get('products') @Public() @ApiOperation({ summary: 'Search approved products and approved seller offers' })
  products(@Query() query: CatalogQueryDto) { return this.catalog.listProducts(query); }
  @Get('products/:slug') @Public() product(@Param('slug') slug: string, @Query('pinCode') pinCode?: string) { return this.catalog.productBySlug(slug, pinCode); }
}

@ApiTags('supplier catalog')
@ApiBearerAuth()
@Controller('supplier')
export class SupplierCatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Post('products') @Roles('SUPPLIER')
  @ApiOperation({ summary: 'Submit a product and offer for admin review; offer stays hidden until approved' })
  submitProduct(@Req() request: AuthenticatedRequest, @Body() dto: CreateSupplierProductDto) { return this.catalog.submitSupplierProduct(request.user.sub, request.user.organizationId, dto); }
  @Patch('offers/:offerId/stock') @Roles('SUPPLIER')
  adjustStock(@Req() request: AuthenticatedRequest, @Param('offerId') offerId: string, @Body() dto: AdjustStockDto) { return this.catalog.adjustOwnOfferStock(request.user.sub, request.user.organizationId, offerId, dto); }
}
