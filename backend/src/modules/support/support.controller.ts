import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { CreateSupportTicketDto, UpdateSupportTicketDto } from './support.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}
  @Get('tickets') @Roles('RETAILER') list(@Req() request: AuthenticatedRequest) { return this.support.list(request.user); }
  @Post('tickets') @Roles('RETAILER') create(@Req() request: AuthenticatedRequest, @Body() dto: CreateSupportTicketDto) { return this.support.create(request.user, dto); }
  @Get('admin/tickets') @Roles('ADMIN', 'SUPPORT') listForSupport(@Req() request: AuthenticatedRequest) { return this.support.listForSupport(request.user); }
  @Patch('admin/tickets/:id') @Roles('ADMIN', 'SUPPORT') updateForSupport(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateSupportTicketDto) { return this.support.updateForSupport(request.user, id, dto); }
}
