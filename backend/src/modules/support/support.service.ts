import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/auth.types';
import { CreateSupportTicketDto, UpdateSupportTicketDto } from './support.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const organizationId = await this.retailerOrganization(user);
    return this.prisma.supportTicket.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async create(user: AuthUser, dto: CreateSupportTicketDto) {
    const organizationId = await this.retailerOrganization(user);
    return this.prisma.supportTicket.create({ data: { organizationId, subject: dto.subject.trim(), message: dto.message.trim() } });
  }

  listForSupport(user: AuthUser) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPPORT) throw new BadRequestException('Support access is required');
    return this.prisma.supportTicket.findMany({
      include: { organization: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], take: 300,
    });
  }

  async updateForSupport(user: AuthUser, id: string, dto: UpdateSupportTicketDto) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPPORT) throw new BadRequestException('Support access is required');
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return this.prisma.supportTicket.update({ where: { id }, data: { status: dto.status, adminReply: dto.adminReply.trim() || null } });
  }

  private async retailerOrganization(user: AuthUser) {
    if (!user.organizationId) throw new BadRequestException('A retailer business account is required');
    const organization = await this.prisma.organization.findUnique({ where: { id: user.organizationId }, select: { id: true, type: true } });
    if (!organization || organization.type !== OrganizationType.RETAILER) throw new BadRequestException('A retailer business account is required');
    return organization.id;
  }
}
