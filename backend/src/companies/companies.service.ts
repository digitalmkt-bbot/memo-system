import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}
  findAll() {
    return this.prisma.company.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { id: 'asc' },
    });
  }
}
