import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class TestRetailerLoginDto {
  @IsString() @Matches(/^\d{10}$/)
  phoneNumber!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Asha Das' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) @Matches(/\S/)
  name?: string;

  @ApiPropertyOptional({ example: 'Green Valley Stores' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) @Matches(/\S/)
  organizationName?: string;

  @ApiPropertyOptional({ example: '+919876543210', nullable: true })
  @IsOptional() @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string | null;

  @ApiPropertyOptional({ enum: ['PROPRIETOR', 'PRIVATE_LIMITED', 'PARTNERSHIP'] })
  @IsOptional() @IsIn(['PROPRIETOR', 'PRIVATE_LIMITED', 'PARTNERSHIP'])
  businessEntityType?: 'PROPRIETOR' | 'PRIVATE_LIMITED' | 'PARTNERSHIP';
}

export class UploadComplianceDocumentDto {
  @ApiProperty({ enum: ['AADHAAR_FRONT', 'AADHAAR_BACK', 'GST_CERTIFICATE', 'PAN_CARD', 'VOTER_ID_FRONT', 'VOTER_ID_BACK', 'LICENSE', 'SUPPORTING_ID'] })
  @IsIn(['AADHAAR_FRONT', 'AADHAAR_BACK', 'GST_CERTIFICATE', 'PAN_CARD', 'VOTER_ID_FRONT', 'VOTER_ID_BACK', 'LICENSE', 'SUPPORTING_ID'])
  documentType!: 'AADHAAR_FRONT' | 'AADHAAR_BACK' | 'GST_CERTIFICATE' | 'PAN_CARD' | 'VOTER_ID_FRONT' | 'VOTER_ID_BACK' | 'LICENSE' | 'SUPPORTING_ID';
}

export class PrincipalCertificateApplicationDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional() @IsString() @MaxLength(1000)
  purpose?: string;
}

export class RetailerBusinessProfileDto {
  @IsOptional() @IsString() @Matches(/^[0-9A-Z]{15}$/i) gstin?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i) panNumber?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) bankAccountName?: string;
  @IsOptional() @IsString() @Matches(/^\d{6,34}$/) bankAccountNumber?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/i) bankIfsc?: string;
}
