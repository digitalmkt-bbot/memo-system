import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SetAnnouncementDto } from './announcements.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  /** The single, global announcement (row id = 1) or null. */
  async current() {
    return this.prisma.announcement.findUnique({ where: { id: 1 } });
  }

  /** Admin sets/updates the global announcement. Empty message = turn it off. */
  async set(userId: number, dto: SetAnnouncementDto) {
    const message = (dto.message ?? '').trim();
    const active = dto.active ?? message.length > 0;
    return this.prisma.announcement.upsert({
      where: { id: 1 },
      create: { id: 1, message, active, updatedBy: userId },
      update: { message, active, updatedBy: userId },
    });
  }
}
