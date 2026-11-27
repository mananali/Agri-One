import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { CheckoutDto, CreateReturnRequestDto, FulfillmentDecisionDto } from './orders.dto';
import { DeliveryAddressDto, UpdateDeliveryAddressDto } from './account.dto';
import { OrdersService } from './orders.service';
import { StatementQueryDto } from './statement.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post('checkout') @Roles('RETAILER')
  @ApiOperation({ summary: 'Place a retailer order; reserves stock and splits fulfillment by seller and source' })
  checkout(@Req() request: AuthenticatedRequest, @Body() dto: CheckoutDto, @Headers('idempotency-key') idempotencyKey?: string) { return this.orders.checkout(request.user, dto, idempotencyKey); }
  @Get() @Roles('RETAILER', 'SUPPLIER', 'ADMIN', 'WAREHOUSE', 'DELIVERY', 'FINANCE', 'SUPPORT')
  list(@Req() request: AuthenticatedRequest) { return this.orders.listOrders(request.user); }
  @Get('addresses') @Roles('RETAILER')
  addresses(@Req() request: AuthenticatedRequest) { return this.orders.listAddresses(request.user); }
  @Post('addresses') @Roles('RETAILER')
  createAddress(@Req() request: AuthenticatedRequest, @Body() dto: DeliveryAddressDto) { return this.orders.createAddress(request.user, dto); }
  @Patch('addresses/:id') @Roles('RETAILER')
  updateAddress(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateDeliveryAddressDto) { return this.orders.updateAddress(request.user, id, dto); }
  @Delete('addresses/:id') @Roles('RETAILER')
  deleteAddress(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.orders.deleteAddress(request.user, id); }
  @Get('statement') @Roles('RETAILER')
  statement(@Req() request: AuthenticatedRequest, @Query() query: StatementQueryDto) { return this.orders.statement(request.user, query); }
  @Get(':orderNumber/invoice') @Roles('RETAILER', 'ADMIN', 'FINANCE', 'SUPPORT')
  invoice(@Req() request: AuthenticatedRequest, @Param('orderNumber') orderNumber: string) { return this.orders.invoice(request.user, orderNumber); }
  @Post(':orderNumber/returns') @Roles('RETAILER')
  requestReturn(@Req() request: AuthenticatedRequest, @Param('orderNumber') orderNumber: string, @Body() dto: CreateReturnRequestDto) { return this.orders.requestReturn(request.user, orderNumber, dto); }
  @Get(':orderNumber') @Roles('RETAILER', 'SUPPLIER', 'ADMIN', 'WAREHOUSE', 'DELIVERY', 'FINANCE', 'SUPPORT')
  byNumber(@Req() request: AuthenticatedRequest, @Param('orderNumber') orderNumber: string) { return this.orders.orderByNumber(request.user, orderNumber); }
  @Patch('fulfillments/:fulfillmentId/decision') @Roles('SUPPLIER')
  decide(@Req() request: AuthenticatedRequest, @Param('fulfillmentId') fulfillmentId: string, @Body() dto: FulfillmentDecisionDto) { return this.orders.decideFulfillment(request.user, fulfillmentId, dto.decision === 'ACCEPT', dto.reason); }
}
