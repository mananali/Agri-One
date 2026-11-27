import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountStatus } from '@prisma/client';
import { Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { AdminPermissionsDto, AdminUserStatusDto } from './admin.dto';
import { AdminActivityQueryDto, BusinessExpenseDto, CreateCashAccountDto, CreatePurchaseOrderDto, CreateStaffDto, ReceivePurchaseOrderDto, RetailerCollectionDto, RetailerRefundDto, StockAdjustmentDto, SupplierPaymentDto } from './erp.dto';
import { ErpService } from './erp.service';

@ApiTags('admin ERP')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class ErpController {
  constructor(private readonly erp: ErpService) {}

  @Get('business-dashboard') dashboard() { return this.erp.dashboard(); }
  @Get('purchases') purchases() { return this.erp.purchases(); }
  @Get('purchases/suppliers') supplierDirectory() { return this.erp.supplierDirectory(); }
  @Post('purchases') createPurchase(@Req() req: AuthenticatedRequest, @Body() dto: CreatePurchaseOrderDto) { return this.erp.createPurchaseOrder(req.user.sub, dto); }
  @Patch('purchases/:id/approve') approvePurchase(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.erp.approvePurchaseOrder(req.user.sub, id); }
  @Post('purchases/:id/receive') receivePurchase(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body() dto: ReceivePurchaseOrderDto) { return this.erp.receivePurchaseOrder(req.user.sub, id, key, dto); }

  @Get('finance') finance() { return this.erp.finance(); }
  @Post('finance/accounts') createCashAccount(@Req() req: AuthenticatedRequest, @Body() dto: CreateCashAccountDto) { return this.erp.createCashAccount(req.user.sub, dto); }
  @Post('finance/collections') collectRetailerPayment(@Req() req: AuthenticatedRequest, @Headers('idempotency-key') key: string | undefined, @Body() dto: RetailerCollectionDto) { return this.erp.collectRetailerPayment(req.user.sub, key, dto); }
  @Post('finance/supplier-payments') paySupplier(@Req() req: AuthenticatedRequest, @Headers('idempotency-key') key: string | undefined, @Body() dto: SupplierPaymentDto) { return this.erp.paySupplier(req.user.sub, key, dto); }
  @Post('finance/refunds') refundRetailerReceipt(@Req() req: AuthenticatedRequest, @Headers('idempotency-key') key: string | undefined, @Body() dto: RetailerRefundDto) { return this.erp.refundRetailerReceipt(req.user.sub, key, dto); }
  @Post('finance/expenses') createExpense(@Req() req: AuthenticatedRequest, @Headers('idempotency-key') key: string | undefined, @Body() dto: BusinessExpenseDto) { return this.erp.createExpense(req.user.sub, key, dto); }

  @Get('staff') staff() { return this.erp.staff(); }
  @Post('staff') createStaff(@Req() req: AuthenticatedRequest, @Body() dto: CreateStaffDto) { return this.erp.createStaff(req.user.sub, dto); }
  @Patch('staff/:id/status') updateStaffStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminUserStatusDto) { return this.erp.setStaffStatus(req.user.sub, id, dto.status as AccountStatus); }
  @Patch('staff/:id/permissions') updateStaffPermissions(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdminPermissionsDto) { return this.erp.setStaffPermissions(req.user.sub, id, dto.permissions); }
  @Get('activity') activity(@Query() query: AdminActivityQueryDto) { return this.erp.activity(query); }
  @Get('errors') errors() { return this.erp.errors(); }
  @Get('backups') backups() { return this.erp.backups(); }
  @Post('backups') createBackup(@Req() req: AuthenticatedRequest) { return this.erp.createDatabaseBackup(req.user.sub); }
  @Get('returns') returns() { return this.erp.returns(); }
  @Post('inventory/:id/adjustment') adjustInventory(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: StockAdjustmentDto) { return this.erp.adjustInventory(req.user.sub, id, dto); }
}
