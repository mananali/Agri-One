import { Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  inbox(@Req() req: AuthenticatedRequest) {
    return this.prisma.notificationRecipient.findMany({
      where: { userId: req.user.sub },
      include: { notification: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Patch(':id/read')
  markRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.prisma.notificationRecipient.updateMany({
      where: { notificationId: id, userId: req.user.sub, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
