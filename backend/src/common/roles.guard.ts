import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { ROLES_KEY } from './auth.decorator';
import type { AuthenticatedRequest } from './auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user || !roles.includes(request.user.role)) throw new ForbiddenException('Your role cannot perform this action');
    if (request.user.role === 'ADMIN' && request.baseUrl.includes('/admin')) {
      const section = request.originalUrl.split('/admin/')[1]?.split(/[/?]/)[0] ?? '';
      const permissionBySection: Record<string, string> = { overview: 'REPORTS', products: 'CATALOG', categories: 'CATALOG', brands: 'CATALOG', 'home-category-cards': 'CATALOG', 'catalog-structure': 'CATALOG', promotions: 'CATALOG', organizations: 'RETAILERS', users: 'USERS', orders: 'ORDERS', returns: 'ORDERS', offers: 'INVENTORY', inventory: 'INVENTORY', ledger: 'FINANCE', payments: 'FINANCE', finance: 'FINANCE', deliveries: 'DELIVERY', reports: 'REPORTS', 'business-dashboard': 'REPORTS', notifications: 'NOTIFICATIONS', settings: 'SETTINGS', backups: 'SETTINGS', 'mobile-home': 'SETTINGS', purchases: 'PURCHASING', staff: 'STAFF', activity: 'ACTIVITY', errors: 'ACTIVITY' };
      const required = permissionBySection[section];
      if (required) {
        const account = await this.prisma.user.findUnique({ where: { id: request.user.sub }, select: { isSuperAdmin: true, adminPermissions: true } });
        if (!account || (!account.isSuperAdmin && !account.adminPermissions.includes(required as never))) throw new ForbiddenException('Your admin account does not have permission for this module');
      }
    }
    return true;
  }
}
