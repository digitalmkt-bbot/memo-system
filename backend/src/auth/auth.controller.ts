import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
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
