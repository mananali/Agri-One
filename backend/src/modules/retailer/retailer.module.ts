import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RetailerController } from './retailer.controller';
import { RetailerService } from './retailer.service';

@Module({ imports: [PrismaModule], controllers: [RetailerController], providers: [RetailerService] })
export class RetailerModule {}
