import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ companyId: 'asc' }, { id: 'asc' }],
      select: {
        id: true, employeeCode: true, name: true, email: true, role: true, active: true,
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
      companyCode: u.company?.code ?? null,
      companyName: u.company?.name ?? null,
      deptCode: u.department?.code ?? null,
      deptName: u.department?.name ?? null,
      managerName: u.manager?.name ?? null,
    }));
  }
}
