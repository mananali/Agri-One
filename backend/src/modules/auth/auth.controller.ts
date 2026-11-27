import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public, Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { AuthService } from './auth.service';
import { LoginDto, PrincipalCertificateApplicationDto, RegisterDto, RetailerBusinessProfileDto, TestRetailerLoginDto, UpdateProfileDto, UploadComplianceDocumentDto } from './auth.dto';
import { UpdateShopDetailsDto } from './shop-details.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') @Public()
  @ApiOperation({ summary: 'Register a retailer or supplier business. Admin roles cannot self-register.' })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post('login') @Public()
  @ApiOperation({ summary: 'Sign in and receive a bearer token' })
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Post('test-retailer-login') @Public()
  @ApiOperation({ summary: 'Development-only login for the configured retailer test phone; disabled in production' })
  testRetailerLogin(@Body() dto: TestRetailerLoginDto) { return this.auth.testRetailerLogin(dto.phoneNumber); }

  @Get('me') @ApiBearerAuth()
  current(@Req() request: AuthenticatedRequest) { return this.auth.currentUser(request.user.sub); }

  @Patch('me') @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the signed-in user and organization profile details' })
  updateCurrent(@Req() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(request.user.sub, request.user.organizationId, dto);
  }

  @Get('me/shop-details') @ApiBearerAuth() @Roles('RETAILER')
  @ApiOperation({ summary: 'Read retailer shop details and verification lock status' })
  shopDetails(@Req() request: AuthenticatedRequest) {
    return this.auth.shopDetails(request.user.sub, request.user.organizationId);
  }

  @Patch('me/shop-details') @ApiBearerAuth() @Roles('RETAILER')
  @ApiOperation({ summary: 'Update retailer shop details before verification is approved' })
  updateShopDetails(@Req() request: AuthenticatedRequest, @Body() dto: UpdateShopDetailsDto) {
    return this.auth.updateShopDetails(request.user.sub, request.user.organizationId, dto);
  }

  @Get('me/retailer-profile') @ApiBearerAuth() @Roles('RETAILER')
  retailerBusinessProfile(@Req() request: AuthenticatedRequest) { return this.auth.retailerBusinessProfile(request.user.sub, request.user.organizationId); }

  @Patch('me/retailer-profile') @ApiBearerAuth() @Roles('RETAILER')
  updateRetailerBusinessProfile(@Req() request: AuthenticatedRequest, @Body() dto: RetailerBusinessProfileDto) { return this.auth.updateRetailerBusinessProfile(request.user.sub, request.user.organizationId, dto); }

  @Get('me/documents') @ApiBearerAuth()
  @ApiOperation({ summary: 'List compliance document review statuses for the signed-in organization' })
  documents(@Req() request: AuthenticatedRequest) {
    return this.auth.listDocuments(request.user.sub, request.user.organizationId);
  }

  @Post('me/documents') @ApiBearerAuth() @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => callback(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)),
  }))
  @ApiOperation({ summary: 'Upload a private supporting ID or business license document' })
  uploadDocument(@Req() request: AuthenticatedRequest, @Body() dto: UploadComplianceDocumentDto, @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }) {
    if (!file) throw new BadRequestException('Choose a PDF, JPG, or PNG document under 8 MB');
    const validSignature = file.mimetype === 'application/pdf' ? file.buffer.subarray(0, 5).toString() === '%PDF-' : file.mimetype === 'image/png' ? file.buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : file.buffer.subarray(0, 3).toString('hex') === 'ffd8ff';
    if (!validSignature) throw new BadRequestException('The file contents do not match the selected document type');
    return this.auth.uploadDocument(request.user.sub, request.user.organizationId, dto.documentType, file);
  }

  @Get('me/documents/:id/file') @ApiBearerAuth()
  async downloadDocument(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Res() response: Response) {
    const file = await this.auth.getDocumentFile(request.user.sub, request.user.organizationId, id);
    response.setHeader('Cache-Control', 'private, no-store');
    response.download(file.path, file.originalName);
  }

  @Delete('me/documents/:id') @ApiBearerAuth()
  deleteDocument(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.auth.deleteDocument(request.user.sub, request.user.organizationId, id);
  }

  @Get('me/certificate-applications') @ApiBearerAuth()
  listCertificateApplications(@Req() request: AuthenticatedRequest) {
    return this.auth.listCertificateApplications(request.user.sub, request.user.organizationId);
  }

  @Post('me/certificate-applications') @ApiBearerAuth()
  applyForPrincipalCertificate(@Req() request: AuthenticatedRequest, @Body() dto: PrincipalCertificateApplicationDto) {
    return this.auth.applyForPrincipalCertificate(request.user.sub, request.user.organizationId, dto);
  }

  @Get('me/wallet') @ApiBearerAuth()
  wallet(@Req() request: AuthenticatedRequest) {
    return this.auth.wallet(request.user.sub, request.user.organizationId);
  }
}
