import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Green Valley Stores' })
  @IsString() @MinLength(2) @MaxLength(120)
  organizationName!: string;

  @ApiProperty({ example: 'owner@example.in' })
  @IsEmail() @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 12, example: 'AtLeast12Chars!' })
  @IsString() @MinLength(12) @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Asha Das' })
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '+919876543210', required: false })
  @IsOptional() @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string;

  @ApiProperty({ enum: ['RETAILER', 'SUPPLIER'] })
  @IsIn(['RETAILER', 'SUPPLIER'])
  accountType!: 'RETAILER' | 'SUPPLIER';
}

export class LoginDto {
  @ApiProperty({ example: 'owner@example.in or CodeEnv' })
  @IsString() @MinLength(3) @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString() @Length(1, 72)
  password!: string;
}
