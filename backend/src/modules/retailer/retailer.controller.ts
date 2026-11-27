import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { RetailerStockDto, UpdateRetailerStockDto } from './retailer.dto';
import { RetailerService } from './retailer.service';

@ApiTags('retailer')
@ApiBearerAuth()
@Controller('retailer')
@Roles('RETAILER')
export class RetailerController {
  constructor(private readonly retailer: RetailerService) {}
  @Get('stock') listStock(@Req() request: AuthenticatedRequest) { return this.retailer.listStock(request.user); }
  @Post('stock') addStock(@Req() request: AuthenticatedRequest, @Body() dto: RetailerStockDto) { return this.retailer.addStock(request.user, dto); }
  @Patch('stock/:id') updateStock(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateRetailerStockDto) { return this.retailer.updateStock(request.user, id, dto); }
  @Delete('stock/:id') removeStock(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.retailer.removeStock(request.user, id); }
}
