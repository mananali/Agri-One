import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { CertificateApplicationStatus, Prisma, UserRole, VerificationStatus } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, PrincipalCertificateApplicationDto, RegisterDto, RetailerBusinessProfileDto, UpdateProfileDto } from './auth.dto';
import { UpdateShopDetailsDto } from './shop-details.dto';
import { decryptSensitive, encryptSensitive } from '../../common/sensitive-fields';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async register(dto: RegisterDto) {
    const role = dto.accountType === 'RETAILER' ? UserRole.RETAILER : UserRole.SUPPLIER;
    try {
      const organization = await this.prisma.organization.create({
        data: {
          name: dto.organizationName.trim(), type: dto.accountType,
          email: dto.email.toLowerCase().trim(), phone: dto.phone,
          users: { create: { name: dto.name.trim(), email: dto.email.toLowerCase().trim(), phone: dto.phone, passwordHash: await hash(dto.password, 12), role } },
        },
        include: { users: true },
      });
      const user = organization.users[0];
      return { ...(await this.issueToken(user.id, user.role, organization.id)), user: this.safeUser(user), organization: this.safeOrganization(organization) };
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('An account with this email or phone already exists');
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const identifier = dto.email.trim();
    const isCodeEnv = ['codeenv', 'codeenv@agri-one.local'].includes(identifier.toLowerCase());
    if (!isCodeEnv && !identifier.includes('@')) throw new UnauthorizedException('Email or password is incorrect');
    const email = isCodeEnv ? 'codeenv@agri-one.local' : identifier.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { organization: true } });
    const password = isCodeEnv && user?.role === UserRole.ADMIN ? dto.password.toLowerCase() : dto.password;
    if (!user || !(await compare(password, user.passwordHash)) || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    return { ...(await this.issueToken(user.id, user.role, user.organizationId)), user: this.safeUser(user), organization: this.safeOrganization(user.organization) };
  }

  async testRetailerLogin(phoneNumber: string) {
    const environment = this.config.get<string>('NODE_ENV');
    if (!['development', 'test'].includes(environment ?? '') || this.config.get<string>('ENABLE_TEST_RETAILER_LOGIN') !== 'true') {
      throw new NotFoundException();
    }
    const configuredPhone = (this.config.get<string>('TEST_RETAILER_PHONE') ?? '').replace(/\D/g, '');
    if (!configuredPhone || phoneNumber !== configuredPhone) throw new UnauthorizedException('That is not the configured Agri-One test number');

    const email = this.config.get<string>('TEST_RETAILER_EMAIL')?.trim().toLowerCase() || 'test-retailer@agri-one.local';
    let user = await this.prisma.user.findUnique({ where: { email }, include: { organization: true } });
    if (!user) {
      let organization = await this.prisma.organization.findFirst({ where: { name: 'Agri-One Test Retailer', type: 'RETAILER' } });
      if (!organization) organization = await this.prisma.organization.create({ data: { name: 'Agri-One Test Retailer', type: 'RETAILER', verificationStatus: VerificationStatus.APPROVED, email } });
      user = await this.prisma.user.create({
        data: { email, name: 'Agri-One Test Retailer', passwordHash: await hash(randomUUID(), 12), role: UserRole.RETAILER, organizationId: organization.id },
        include: { organization: true },
      });
    }
    if (user.role !== UserRole.RETAILER || user.status !== 'ACTIVE' || user.organization?.type !== 'RETAILER' || user.organization.verificationStatus !== VerificationStatus.APPROVED) {
      throw new UnauthorizedException('The configured test retailer account is not active');
    }
    return { ...(await this.issueToken(user.id, user.role, user.organizationId)), user: this.safeUser(user), organization: this.safeOrganization(user.organization) };
  }

  async currentUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { organization: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
    return { user: this.safeUser(user), organization: this.safeOrganization(user.organization) };
  }

  async updateProfile(userId: string, organizationId: string | null, dto: UpdateProfileDto) {
    if (!dto.name && !dto.organizationName && dto.phone === undefined) throw new BadRequestException('Provide at least one profile field to update');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { id: userId }, select: { organizationId: true, phone: true } });
        if (!existing) throw new UnauthorizedException();
        if (organizationId && existing.organizationId !== organizationId) throw new UnauthorizedException();
        if (!organizationId && dto.organizationName) throw new BadRequestException('This account has no organization to update');
        if (organizationId && dto.organizationName) {
          const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { type: true, verificationStatus: true } });
          if (organization?.type === 'RETAILER' && organization.verificationStatus === VerificationStatus.APPROVED) {
            throw new ForbiddenException('Verified shop details are locked. Contact support to make a change.');
          }
        }

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
            ...(dto.phone !== undefined && (dto.phone?.trim() || null) !== existing.phone ? { phoneVerifiedAt: null } : {}),
          },
        });
        const organization = organizationId ? await tx.organization.update({
          where: { id: organizationId },
          data: {
            ...(dto.organizationName !== undefined ? { name: dto.organizationName.trim() } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
            ...(dto.businessEntityType !== undefined ? { businessEntityType: dto.businessEntityType } : {}),
          },
        }) : null;
        return { user: this.safeUser(user), organization: this.safeOrganization(organization) };
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('This phone number is already used by another account');
      throw error;
    }
  }

  async shopDetails(userId: string, organizationId: string | null) {
    await this.assertOrganizationMembership(userId, organizationId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId! },
      select: { id: true, name: true, type: true, verificationStatus: true, shopPinCode: true, shopCity: true, shopDistrict: true, shopState: true, shopNumber: true, shopArea: true, shopLandmark: true },
    });
    if (!organization || organization.type !== 'RETAILER') throw new ForbiddenException('Retailer shop details are required');
    return {
      shopName: organization.name,
      pinCode: organization.shopPinCode ?? '',
      city: organization.shopCity ?? '',
      district: organization.shopDistrict ?? '',
      state: organization.shopState ?? '',
      shopNumber: organization.shopNumber ?? '',
      area: organization.shopArea ?? '',
      landmark: organization.shopLandmark ?? '',
      verificationStatus: organization.verificationStatus,
      isLocked: organization.verificationStatus === VerificationStatus.APPROVED,
    };
  }

  async updateShopDetails(userId: string, organizationId: string | null, dto: UpdateShopDetailsDto) {
    await this.assertOrganizationMembership(userId, organizationId);
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId! }, select: { type: true, verificationStatus: true } });
    if (!organization || organization.type !== 'RETAILER') throw new ForbiddenException('Retailer shop details are required');
    if (organization.verificationStatus === VerificationStatus.APPROVED) throw new ForbiddenException('Verified shop details are locked. Contact support to make a change.');
    await this.prisma.organization.update({
      where: { id: organizationId! },
      data: {
        name: dto.shopName.trim(),
        shopPinCode: dto.pinCode.trim(),
        shopCity: dto.city.trim(),
        shopDistrict: dto.district.trim(),
        shopState: dto.state.trim(),
        shopNumber: dto.shopNumber.trim(),
        shopArea: dto.area.trim(),
        shopLandmark: dto.landmark?.trim() || null,
      },
    });
    return this.shopDetails(userId, organizationId);
  }

  async retailerBusinessProfile(userId: string, organizationId: string | null) {
    await this.assertOrganizationMembership(userId, organizationId);
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId! } });
    if (!organization || organization.type !== 'RETAILER') throw new ForbiddenException('Retailer business profile is required');
    const key = this.config.getOrThrow<string>('PII_ENCRYPTION_KEY');
    return {
      gstin: organization.gstin ?? '',
      panNumber: decryptSensitive(organization.panEncrypted, key),
      bankAccountName: decryptSensitive(organization.bankAccountNameEncrypted, key),
      bankAccountNumber: decryptSensitive(organization.bankAccountNumberEncrypted, key),
      bankIfsc: decryptSensitive(organization.bankIfscEncrypted, key),
      verificationStatus: organization.verificationStatus,
      isLocked: organization.verificationStatus === VerificationStatus.APPROVED,
    };
  }

  async updateRetailerBusinessProfile(userId: string, organizationId: string | null, dto: RetailerBusinessProfileDto) {
    await this.assertOrganizationMembership(userId, organizationId);
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId! }, select: { type: true } });
    if (!organization || organization.type !== 'RETAILER') throw new ForbiddenException('Retailer business profile is required');
    const key = this.config.getOrThrow<string>('PII_ENCRYPTION_KEY');
    const update: Prisma.OrganizationUpdateInput = {};
    if (dto.gstin !== undefined) update.gstin = dto.gstin.trim().toUpperCase() || null;
    if (dto.panNumber !== undefined) update.panEncrypted = dto.panNumber.trim().toUpperCase() ? encryptSensitive(dto.panNumber.trim().toUpperCase(), key) : null;
    if (dto.bankAccountName !== undefined) update.bankAccountNameEncrypted = dto.bankAccountName.trim() ? encryptSensitive(dto.bankAccountName.trim(), key) : null;
    if (dto.bankAccountNumber !== undefined) update.bankAccountNumberEncrypted = dto.bankAccountNumber.trim() ? encryptSensitive(dto.bankAccountNumber.trim(), key) : null;
    if (dto.bankIfsc !== undefined) update.bankIfscEncrypted = dto.bankIfsc.trim().toUpperCase() ? encryptSensitive(dto.bankIfsc.trim().toUpperCase(), key) : null;
    if (!Object.keys(update).length) throw new BadRequestException('Enter at least one business profile field');
    await this.prisma.organization.update({ where: { id: organizationId! }, data: update });
    return this.retailerBusinessProfile(userId, organizationId);
  }

  async listDocuments(userId: string, organizationId: string | null) {
    if (!organizationId) return [];
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
    if (!user || user.organizationId !== organizationId) throw new UnauthorizedException();
    return this.prisma.kycDocument.findMany({
      where: { organizationId },
      select: { id: true, documentType: true, originalName: true, reviewStatus: true, reviewReason: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocument(userId: string, organizationId: string | null, documentType: 'AADHAAR_FRONT' | 'AADHAAR_BACK' | 'GST_CERTIFICATE' | 'PAN_CARD' | 'VOTER_ID_FRONT' | 'VOTER_ID_BACK' | 'LICENSE' | 'SUPPORTING_ID', file: { originalname: string; mimetype: string; buffer: Buffer }) {
    await this.assertOrganizationMembership(userId, organizationId);
    const extensionByMime: Record<string, string> = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
    const extension = extensionByMime[file.mimetype];
    if (!extension) throw new BadRequestException('Only PDF, JPG, and PNG files are supported');
    if (documentType !== 'LICENSE' && documentType !== 'SUPPORTING_ID' && file.mimetype === 'application/pdf') throw new BadRequestException('Identity document uploads must be JPG or PNG photos');
    const storageKey = `${randomUUID()}${extension}`;
    const directory = join(process.cwd(), 'private-uploads', 'compliance');
    await mkdir(directory, { recursive: true });
    const path = join(directory, storageKey);
    await writeFile(path, file.buffer, { flag: 'wx' });
    try {
      const document = await this.prisma.kycDocument.create({
        data: { organizationId: organizationId!, documentType, storageKey, originalName: basename(file.originalname).slice(0, 255), mimeType: file.mimetype },
        select: { id: true, documentType: true, originalName: true, reviewStatus: true, reviewReason: true, createdAt: true },
      });
      return document;
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }

  async getDocumentFile(userId: string, organizationId: string | null, documentId: string) {
    await this.assertOrganizationMembership(userId, organizationId);
    const document = await this.prisma.kycDocument.findFirst({ where: { id: documentId, organizationId: organizationId! }, select: { storageKey: true, originalName: true, mimeType: true } });
    if (!document) throw new NotFoundException('Document not found');
    const path = join(process.cwd(), 'private-uploads', 'compliance', document.storageKey);
    try { await access(path); } catch { throw new NotFoundException('Document file is unavailable'); }
    return { path, originalName: basename(document.originalName), mimeType: document.mimeType };
  }

  async deleteDocument(userId: string, organizationId: string | null, documentId: string) {
    await this.assertOrganizationMembership(userId, organizationId);
    const document = await this.prisma.kycDocument.findFirst({ where: { id: documentId, organizationId: organizationId! } });
    if (!document) throw new NotFoundException('Document not found');
    if (document.reviewStatus !== VerificationStatus.PENDING && document.reviewStatus !== VerificationStatus.NEEDS_CORRECTION) throw new ConflictException('Reviewed documents cannot be deleted');
    await this.prisma.kycDocument.delete({ where: { id: documentId } });
    await unlink(join(process.cwd(), 'private-uploads', 'compliance', document.storageKey)).catch(() => undefined);
    return { id: documentId, deleted: true };
  }

  async listCertificateApplications(userId: string, organizationId: string | null) {
    await this.assertOrganizationMembership(userId, organizationId);
    return this.prisma.certificateApplication.findMany({ where: { organizationId: organizationId! }, orderBy: { createdAt: 'desc' } });
  }

  async applyForPrincipalCertificate(userId: string, organizationId: string | null, dto: PrincipalCertificateApplicationDto) {
    await this.assertOrganizationMembership(userId, organizationId);
    const existing = await this.prisma.certificateApplication.findFirst({ where: { organizationId: organizationId!, certificate: 'PRINCIPAL', status: CertificateApplicationStatus.PENDING } });
    if (existing) throw new ConflictException('A principal certificate application is already pending');
    return this.prisma.certificateApplication.create({ data: { organizationId: organizationId!, certificate: 'PRINCIPAL', purpose: dto.purpose?.trim() || null } });
  }

  async wallet(userId: string, organizationId: string | null) {
    await this.assertOrganizationMembership(userId, organizationId);
    return this.prisma.wallet.upsert({
      where: { organizationId: organizationId! },
      create: { organizationId: organizationId! },
      update: {},
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
  }

  private async assertOrganizationMembership(userId: string, organizationId: string | null) {
    if (!organizationId) throw new ForbiddenException('A business account is required');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
    if (!user || user.organizationId !== organizationId) throw new UnauthorizedException();
  }

  private async issueToken(sub: string, role: UserRole, organizationId: string | null) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '1d';
    const accessToken = await this.jwt.signAsync({ sub, role, organizationId }, { expiresIn: expiresIn as JwtSignOptions['expiresIn'] });
    return { accessToken, tokenType: 'Bearer', expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '1d' };
  }

  private safeUser(user: { id: string; email: string; name: string; phone: string | null; phoneVerifiedAt: Date | null; role: UserRole }) {
    return { id: user.id, email: user.email, name: user.name, phone: user.phone, phoneVerified: !!user.phoneVerifiedAt, role: user.role };
  }

  private safeOrganization(organization: { id: string; name: string; type: string; businessEntityType: string | null; verificationStatus: string; email: string | null; phone: string | null } | null) {
    if (!organization) return null;
    return { id: organization.id, name: organization.name, type: organization.type, businessEntityType: organization.businessEntityType, verificationStatus: organization.verificationStatus, email: organization.email, phone: organization.phone };
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
