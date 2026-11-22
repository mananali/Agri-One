import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth.decorator';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') @Public()
  @ApiOperation({ summary: 'Register a retailer or supplier business. Admin roles cannot self-register.' })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post('login') @Public()
  @ApiOperation({ summary: 'Sign in and receive a bearer token' })
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Get('me') @ApiBearerAuth()
  current(@Req() request: AuthenticatedRequest) { return this.auth.currentUser(request.user.sub); }
}
