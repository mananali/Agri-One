import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class PurchaseOrderLineDto {
  @IsString() @MaxLength(100) productId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) quantity!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsString() @MaxLength(100) supplierOrganizationId!: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique((line: PurchaseOrderLineDto) => line.productId) @ValidateNested({ each: true }) @Type(() => PurchaseOrderLineDto) lines!: PurchaseOrderLineDto[];
}

export class ReceivePurchaseOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique((line: ReceivePurchaseOrderLineDto) => line.lineId) @ValidateNested({ each: true }) @Type(() => ReceivePurchaseOrderLineDto) lines!: ReceivePurchaseOrderLineDto[];
}

export class ReceivePurchaseOrderLineDto {
  @IsString() @MaxLength(100) lineId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) quantity!: number;
}

export class CreateCashAccountDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(['CASH', 'BANK']) type!: 'CASH' | 'BANK';
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @IsOptional() @Matches(/^\d{4}$/) accountNumberLast4?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999) openingBalance = 0;
}

export class RetailerCollectionDto {
  @IsString() @MaxLength(100) retailerId!: string;
  @IsString() @MaxLength(100) orderId!: string;
  @IsString() @MaxLength(100) accountId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999) amount!: number;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class SupplierPaymentDto {
  @IsString() @MaxLength(100) purchaseOrderId!: string;
  @IsString() @MaxLength(100) accountId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999) amount!: number;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class BusinessExpenseDto {
  @IsString() @MaxLength(100) accountId!: string;
  @IsString() @MaxLength(100) category!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999) amount!: number;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsString() @MaxLength(1000) note!: string;
  @IsOptional() @IsString() @MaxLength(30) transactionDate?: string;
}

export class RetailerRefundDto {
  @IsString() @MaxLength(100) receiptTransactionId!: string;
  @IsString() @MaxLength(100) accountId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999) amount!: number;
  @IsString() @MaxLength(500) reason!: string;
}

export class CreateStaffDto {
  @IsString() @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @Matches(/^\+?[0-9]{10,15}$/) phone?: string;
  @IsString() @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/) password!: string;
  @IsIn(['ADMIN', 'WAREHOUSE', 'DELIVERY', 'FINANCE', 'SUPPORT']) role!: 'ADMIN' | 'WAREHOUSE' | 'DELIVERY' | 'FINANCE' | 'SUPPORT';
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(['CATALOG', 'RETAILERS', 'ORDERS', 'INVENTORY', 'FINANCE', 'DELIVERY', 'REPORTS', 'NOTIFICATIONS', 'SETTINGS', 'USERS', 'PURCHASING', 'STAFF', 'ACTIVITY'], { each: true }) permissions?: string[];
}

export class StockAdjustmentDto {
  @Type(() => Number) @IsInt() @Min(-1000000) @Max(1000000) quantityDelta!: number;
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsString() @MaxLength(100) batchNumber?: string;
  @IsOptional() @IsString() @MaxLength(40) expiresAt?: string;
}

export class AdminActivityQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
  @IsOptional() @IsString() @MaxLength(80) entityType?: string;
  @IsOptional() @IsString() @MaxLength(80) action?: string;
}
