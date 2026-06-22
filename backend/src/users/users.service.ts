import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../db/prisma.service';
import { UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ companyId: 'asc' }, { id: 'asc' }],
      select: {
        id: true, employeeCode: true, name: true, email: true, role: true, active: true,
        companyId: true, departmentId: true, managerId: true,
        company: { select: { code: true, name: true } },
        department: { select: { code: true, name: true } },
        manager: { select: { name: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      employeeCode: u.employeeCode,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      companyId: u.companyId,
      departmentId: u.departmentId,
      managerId: u.managerId,
      companyCode: u.company?.code ?? null,
      companyName: u.company?.name ?? null,
      deptCode: u.department?.code ?? null,
      deptName: u.department?.name ?? null,
      managerName: u.manager?.name ?? null,
    }));
  }

  async update(id: number, dto: UpdateUserDto) {
    const data: any = {};
    if (dto.companyId !== undefined) data.companyId = dto.companyId;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId ?? null;
    if (dto.employeeCode !== undefined) data.employeeCode = dto.employeeCode.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    if (dto.role !== undefined) data.role = dto.role as any;
    if (dto.managerId !== undefined) data.managerId = dto.managerId ?? null;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password) data.passwordHash = bcrypt.hashSync(dto.password, 10);
    try {
      await this.prisma.user.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('อีเมลหรือรหัสพนักงานซ้ำกับผู้ใช้อื่น');
      if (e.code === 'P2025') throw new NotFoundException('ไม่พบผู้ใช้');
      throw e;
    }
    return { ok: true };
  }

  async remove(id: number, currentUserId: number) {
    if (id === currentUserId) throw new BadRequestException('ลบบัญชีของตัวเองไม่ได้');
    const [created, approved, asApprover] = await Promise.all([
      this.prisma.memo.count({ where: { createdBy: id } }),
      this.prisma.approval.count({ where: { approvedBy: id } }),
      this.prisma.memo.count({ where: { currentApproverId: id } }),
    ]);
    if (created > 0 || approved > 0 || asApprover > 0) {
      throw new BadRequestException('ผู้ใช้มีบันทึก/ประวัติอนุมัติในระบบ ลบไม่ได้ — แนะนำให้ปิดใช้งานแทน');
    }
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('ไม่พบผู้ใช้');
      throw e;
    }
    return { ok: true };
  }
}
