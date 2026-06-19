import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}
  findAll(companyId?: number) {
    return this.prisma.department.findMany({
      where: companyId ? { companyId } : undefined,
      select: { id: true, companyId: true, code: true, name: true },
      orderBy: [{ companyId: 'asc' }, { position: 'asc' }, { code: 'asc' }],
    });
  }
}
