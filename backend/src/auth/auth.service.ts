import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../db/prisma.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || !user.active || !bcrypt.compareSync(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const token = await this.jwt.signAsync({
      sub: user.id, role: user.role, companyId: user.companyId,
      departmentId: user.departmentId, name: user.name,
    });
    return {
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        companyId: user.companyId, departmentId: user.departmentId,
      },
    };
  }

  async changePassword(dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || !bcrypt.compareSync(dto.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: bcrypt.hashSync(dto.newPassword, 10) },
    });
    return { ok: true };
  }

  async register(dto: RegisterDto) {
    const passwordHash = bcrypt.hashSync(dto.password, 10);
    try {
      const u = await this.prisma.user.create({
        data: {
          companyId: dto.companyId,
          departmentId: dto.departmentId ?? null,
          employeeCode: dto.employeeCode,
          name: dto.name,
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          role: dto.role as any,
          managerId: dto.managerId ?? null,
        },
      });
      return { id: u.id };
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Email or employee code already exists');
      throw e;
    }
  }
}
