import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CatalogQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()
  category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()
  brand?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()
  source?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(6)
  pinCode?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;
}

export class CreateSupplierProductDto {
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(100) categoryId!: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MaxLength(80) packSize!: string;
  @IsString() @MaxLength(30) unit!: string;
  @IsString() @MaxLength(80) sellerSku!: string;
  @Type(() => Number) @IsInt() @Min(1) minimumOrderQuantity!: number;
  @Type(() => Number) @IsInt() @Min(0) initialStock!: number;
  @Type(() => Number) @Min(0) price!: number;
  @IsOptional() @Type(() => Number) @Min(0) mrp?: number;
  @IsOptional() @IsString({ each: true }) servicePinCodes?: string[];
}

export class AdjustStockDto {
  @Type(() => Number) @IsInt() @Min(0) stockOnHand!: number;
  @IsString() @MaxLength(240) reason!: string;
}
