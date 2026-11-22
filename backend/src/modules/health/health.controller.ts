import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness probe that does not require the database' })
  getHealth() { return { status: 'ok', service: 'agri-one-api', timestamp: new Date().toISOString() }; }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe including a database connection check' })
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'unavailable' });
    }
  }
}
