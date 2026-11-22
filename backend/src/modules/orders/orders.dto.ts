import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsPhoneNumber, IsString, Length, MaxLength, Min, ValidateNested } from 'class-validator';

export class CheckoutLineDto {
  @IsString() @MaxLength(40) offerId!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
}

export class CheckoutDto {
  @ApiProperty({ type: [CheckoutLineDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CheckoutLineDto)
  items!: CheckoutLineDto[];

  @IsString() @MaxLength(120) deliveryName!: string;
  @IsPhoneNumber('IN') deliveryPhone!: string;
  @IsString() @Length(8, 300) deliveryAddress!: string;
  @IsString() @MaxLength(100) deliveryArea!: string;
  @IsString() @MaxLength(100) deliveryDistrict!: string;
  @IsString() @Length(6, 6) deliveryPinCode!: string;
}

export class FulfillmentDecisionDto {
  @IsIn(['ACCEPT', 'REJECT']) decision!: 'ACCEPT' | 'REJECT';
  @IsString() @Length(1, 500) reason!: string;
}
