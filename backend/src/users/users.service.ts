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
    if (dto.managerId !== undefined) {
      if (dto.managerId === null) {
        data.managerId = null;
      } else if (dto.managerId === id) {
        throw new BadRequestException('เลือกตัวเองเป็นผู้อนุมัติไม่ได้');
      } else {
        // Validate the chosen approver EXISTS and is ACTIVE — otherwise the FK
        // save fails silently and (if inactive) memos won't route to them.
        const m = await this.prisma.user.findUnique({ where: { id: dto.managerId }, select: { active: true } });
        if (!m) throw new BadRequestException('ไม่พบผู้อนุมัติที่เลือก (อาจถูกลบไปแล้ว) — กรุณาเลือกผู้อนุมัติใหม่');
        if (!m.active) throw new BadRequestException('ผู้อนุมัติที่เลือกถูกปิดใช้งานอยู่ — เปิดใช้งานก่อน หรือเลือกผู้อนุมัติที่ยังใช้งาน');
        data.managerId = dto.managerId;
      }
    }
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
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) throw new NotFoundException('ไม่พบผู้ใช้');
    // HARD delete, but KEEP the documents: re-point every reference that would
    // otherwise block the delete to the admin performing it. The memo's own
    // "ผู้ขอ" text (fromName) is untouched, so the original requester still shows.
    try {
      await this.prisma.$transaction([
        // subordinates lose their first-approver link (must be reassigned later)
        this.prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } }),
        // memos they created & approvals they made survive, transferred to the admin
        this.prisma.memo.updateMany({ where: { createdBy: id }, data: { createdBy: currentUserId } }),
        this.prisma.approval.updateMany({ where: { approvedBy: id }, data: { approvedBy: currentUserId } }),
        // any memo currently waiting on them is left without an approver (re-route)
        this.prisma.memo.updateMany({ where: { currentApproverId: id }, data: { currentApproverId: null } }),
        this.prisma.user.delete({ where: { id } }),
      ]);
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('ไม่พบผู้ใช้');
      throw e;
    }
    return { ok: true };
  }
}
