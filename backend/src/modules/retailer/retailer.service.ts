import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationType, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/auth.types';
import { RetailerStockDto, UpdateRetailerStockDto } from './retailer.dto';

@Injectable()
export class RetailerService {
  constructor(private readonly prisma: PrismaService) {}

  async listStock(user: AuthUser) {
    const organizationId = await this.retailerOrganization(user);
    return this.prisma.retailerStock.findMany({
      where: { organizationId },
      include: { product: { select: { id: true, name: true, slug: true, imageUrl: true, packSize: true, unit: true, category: { select: { name: true } } } } },
      orderBy: [{ quantity: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async addStock(user: AuthUser, dto: RetailerStockDto) {
    const organizationId = await this.retailerOrganization(user);
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, status: ProductStatus.APPROVED }, select: { id: true } });
    if (!product) throw new BadRequestException('Choose an approved catalogue product');
    try {
      return await this.prisma.retailerStock.create({
        data: { organizationId, productId: product.id, quantity: dto.quantity, lowStockThreshold: dto.lowStockThreshold },
        include: { product: { select: { id: true, name: true, imageUrl: true, packSize: true, unit: true, category: { select: { name: true } } } } },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new BadRequestException('This product is already in your shop stock');
      throw error;
    }
  }

  async updateStock(user: AuthUser, id: string, dto: UpdateRetailerStockDto) {
    const organizationId = await this.retailerOrganization(user);
    const result = await this.prisma.retailerStock.updateMany({ where: { id, organizationId }, data: { quantity: dto.quantity, lowStockThreshold: dto.lowStockThreshold } });
    if (!result.count) throw new NotFoundException('Stock item not found');
    return this.prisma.retailerStock.findUniqueOrThrow({
      where: { id },
      include: { product: { select: { id: true, name: true, imageUrl: true, packSize: true, unit: true, category: { select: { name: true } } } } },
    });
  }

  async removeStock(user: AuthUser, id: string) {
    const organizationId = await this.retailerOrganization(user);
    const result = await this.prisma.retailerStock.deleteMany({ where: { id, organizationId } });
    if (!result.count) throw new NotFoundException('Stock item not found');
    return { id, deleted: true };
  }

  private async retailerOrganization(user: AuthUser) {
    if (!user.organizationId) throw new BadRequestException('A retailer business account is required');
    const organization = await this.prisma.organization.findUnique({ where: { id: user.organizationId }, select: { id: true, type: true } });
    if (!organization || organization.type !== OrganizationType.RETAILER) throw new BadRequestException('A retailer business account is required');
    return organization.id;
  }
}
