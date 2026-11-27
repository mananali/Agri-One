import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class ReviewOrganizationDto {
  @IsIn(['APPROVED', 'REJECTED', 'NEEDS_CORRECTION']) status!: 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReviewKycDocumentDto {
  @IsIn(['APPROVED', 'REJECTED', 'NEEDS_CORRECTION']) status!: 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReviewCertificateApplicationDto {
  @IsIn(['APPROVED', 'REJECTED', 'NEEDS_CORRECTION']) status!: 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReviewProductDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class AdminOrganizationsQueryDto {
  @IsOptional() @IsIn(['RETAILER', 'SUPPLIER', 'AGRI_ONE', 'LOGISTICS']) type?: 'RETAILER' | 'SUPPLIER' | 'AGRI_ONE' | 'LOGISTICS';
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION']) status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
  @IsOptional() @Type(() => Number) page = 1;
}

export class AdminProductDto {
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(100) categoryId!: string;
  @IsOptional() @IsString() @MaxLength(100) brandId?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MaxLength(80) packSize!: string;
  @IsString() @MaxLength(30) unit!: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) mrp?: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxRate = 0;
  @IsString() @MaxLength(80) sellerSku!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true }) @Matches(/^\d{6}$/, { each: true }) servicePinCodes!: string[];
  @Type(() => Number) @IsInt() @Min(1) minimumOrderQuantity = 1;
  @Type(() => Number) @IsInt() @Min(0) stockOnHand = 0;
  @IsOptional() @IsIn(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']) status?: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
}

export class AdminOfferDto {
  @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @Type(() => Number) @IsNumber() @Min(0) mrp!: number;
  @Type(() => Number) @IsInt() @Min(1) minimumOrderQuantity!: number;
  @Type(() => Number) @IsInt() @Min(0) stockOnHand!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) commissionRate!: number;
  @IsIn([true, false]) isActive!: boolean;
}

export class AdminNamedRecordDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
}

export class AdminCatalogStatusDto {
  @IsBoolean() isActive!: boolean;
}

export class HomeCategoryCardDto {
  @IsString() @MaxLength(500) imageUrl!: string;
}

export class AdminOrderStatusDto {
  @IsIn(['PLACED', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'DELIVERED', 'PARTIALLY_CANCELLED', 'CANCELLED', 'REJECTED']) status!: string;
}

export class ReviewReturnRequestDto {
  @IsIn(['APPROVED', 'REJECTED', 'COMPLETED']) status!: 'APPROVED' | 'REJECTED' | 'COMPLETED';
  @IsOptional() @IsString() @MaxLength(1000) reviewReason?: string;
}

export class AdminUserStatusDto {
  @IsIn(['ACTIVE', 'DISABLED']) status!: 'ACTIVE' | 'DISABLED';
}

export class AdminNotificationDto {
  @IsString() @MaxLength(160) title!: string;
  @IsString() @MaxLength(2000) body!: string;
  @IsOptional() @IsIn(['ALL', 'RETAILERS', 'SUPPLIERS', 'OPERATIONS']) audience?: 'ALL' | 'RETAILERS' | 'SUPPLIERS' | 'OPERATIONS';
}

export class AdminSettingDto {
  @IsObject() value!: Record<string, unknown>;
}

export class AdminShipmentStatusDto {
  @IsIn(['READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNING', 'RETURNED']) status!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @MaxLength(120) trackingNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) failureReason?: string;
}

export class AdminPermissionsDto {
  @IsArray() @IsIn(['CATALOG', 'RETAILERS', 'ORDERS', 'INVENTORY', 'FINANCE', 'DELIVERY', 'REPORTS', 'NOTIFICATIONS', 'SETTINGS', 'USERS', 'PURCHASING', 'STAFF', 'ACTIVITY'], { each: true }) permissions!: string[];
}

export class AdminPromotionDto {
  @IsString() @MaxLength(160) title!: string;
  @IsString() @MaxLength(1000) body!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsIn(['FESTIVAL', 'BULK', 'REWARDS']) type?: 'FESTIVAL' | 'BULK' | 'REWARDS';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) discountPercent?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) minimumOrderQuantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) coinsPer100?: number;
}

export class MobileHomeTopSellingDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @MaxLength(80) title!: string;
  @IsString() @MaxLength(160) subtitle!: string;
  @IsArray() @ArrayMaxSize(9) @ArrayUnique() @IsString({ each: true }) @MaxLength(100, { each: true }) productIds!: string[];
}

export class AdminPaymentStatusDto {
  @IsIn(['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED']) status!: string;
  @IsOptional() @IsString() @MaxLength(120) providerReference?: string;
}

export class AdminListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
}
