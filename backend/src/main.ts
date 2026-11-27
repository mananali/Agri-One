import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

function isPrivateDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    if ((hostname.endsWith('.exp.direct') || hostname.endsWith('.expo.dev')) && url.protocol === 'https:') return true;
    if (url.protocol !== 'http:' || !['', '3000', '8081', '8082'].includes(url.port)) return false;
    if (hostname === 'localhost') return true;

    const octets = hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [first, second] = octets;
    return first === 10 || first === 127 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const jwtSecret = config.getOrThrow<string>('JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long');
  app.setGlobalPrefix('api/v1');
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  const frontendOrigins = (config.get<string>('FRONTEND_ORIGINS') ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean);
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  if (!isProduction) frontendOrigins.push('http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:8082', 'http://127.0.0.1:8082');
  const allowedOrigins = new Set(frontendOrigins);
  app.enableCors({
    origin: (origin, callback) => {
      const allowed = !origin || allowedOrigins.has(origin) || (!isProduction && isPrivateDevelopmentOrigin(origin));
      callback(null, allowed);
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  const swagger = new DocumentBuilder().setTitle('Agri-One API').setDescription('B2B agriculture marketplace API. Business and catalogue records are scoped by organization.').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  await app.listen(config.get<number>('PORT') ?? 3001);
}

void bootstrap();
