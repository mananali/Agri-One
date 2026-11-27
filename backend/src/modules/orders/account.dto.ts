import { IsBoolean, IsOptional, IsPhoneNumber, IsString, Length, Matches, MaxLength } from 'class-validator';

export class DeliveryAddressDto {
  @IsOptional() @IsString() @MaxLength(40)
  label?: string;

  @IsString() @Length(2, 120)
  recipientName!: string;

  @IsPhoneNumber('IN')
  phone!: string;

  @IsString() @Length(8, 300)
  address!: string;

  @IsString() @Length(2, 100)
  area!: string;

  @IsString() @Length(2, 100)
  district!: string;

  @IsString() @Length(6, 6) @Matches(/^\d{6}$/)
  pinCode!: string;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

export class UpdateDeliveryAddressDto {
  @IsOptional() @IsString() @MaxLength(40)
  label?: string;

  @IsOptional() @IsString() @Length(2, 120)
  recipientName?: string;

  @IsOptional() @IsPhoneNumber('IN')
  phone?: string;

  @IsOptional() @IsString() @Length(8, 300)
  address?: string;

  @IsOptional() @IsString() @Length(2, 100)
  area?: string;

  @IsOptional() @IsString() @Length(2, 100)
  district?: string;

  @IsOptional() @IsString() @Length(6, 6) @Matches(/^\d{6}$/)
  pinCode?: string;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}
