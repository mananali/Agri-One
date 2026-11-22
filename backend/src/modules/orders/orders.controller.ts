import { Body, Controller, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { CheckoutDto, FulfillmentDecisionDto } from './orders.dto';
import { OrdersService } from './orders.service';

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
  @Get(':orderNumber') @Roles('RETAILER', 'SUPPLIER', 'ADMIN', 'WAREHOUSE', 'DELIVERY', 'FINANCE', 'SUPPORT')
  byNumber(@Req() request: AuthenticatedRequest, @Param('orderNumber') orderNumber: string) { return this.orders.orderByNumber(request.user, orderNumber); }
  @Patch('fulfillments/:fulfillmentId/decision') @Roles('SUPPLIER')
  decide(@Req() request: AuthenticatedRequest, @Param('fulfillmentId') fulfillmentId: string, @Body() dto: FulfillmentDecisionDto) { return this.orders.decideFulfillment(request.user, fulfillmentId, dto.decision === 'ACCEPT', dto.reason); }
}
