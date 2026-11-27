import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateShopDetailsDto {
  @IsString() @Length(2, 120)
  shopName!: string;

  @IsString() @Matches(/^\d{6}$/)
  pinCode!: string;

  @IsString() @Length(2, 100)
  city!: string;

  @IsString() @Length(2, 100)
  district!: string;

  @IsString() @Length(2, 100)
  state!: string;

  @IsString() @Length(1, 100)
  shopNumber!: string;

  @IsString() @Length(2, 160)
  area!: string;

  @IsOptional() @IsString() @Length(0, 160)
  landmark?: string;
}
