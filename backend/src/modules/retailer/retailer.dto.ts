import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class RetailerStockDto {
  @IsString() @MaxLength(100) productId!: string;
  @Type(() => Number) @IsInt() @Min(0) quantity!: number;
  @Type(() => Number) @IsInt() @Min(0) lowStockThreshold = 5;
}

export class UpdateRetailerStockDto {
  @Type(() => Number) @IsInt() @Min(0) quantity!: number;
  @Type(() => Number) @IsInt() @Min(0) lowStockThreshold = 5;
}
