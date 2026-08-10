import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(dto);
  }

  // Current user's profile (authoritative company/department from the DB) so the
  // UI can default a new memo to the creator's own department reliably, even if
  // an older token didn't carry departmentId.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.id);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // JWT is stateless; logout is handled client-side by discarding the token.
  // Endpoint exists for API completeness and future token-blacklist support.
  @Post('logout')
  logout() {
    return { ok: true };
  }
}
