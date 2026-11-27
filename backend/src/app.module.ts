import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_FILTER } from '@nestjs/core';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { RetailerModule } from './modules/retailer/retailer.module';
import { SupportModule } from './modules/support/support.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, CatalogModule, OrdersModule, RetailerModule, SupportModule, AdminModule, HealthModule],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: RolesGuard }, { provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
