import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsController } from './notifications.controller';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';

@Module({ controllers: [AdminController, NotificationsController, ErpController], providers: [AdminService, ErpService] })
export class AdminModule {}
