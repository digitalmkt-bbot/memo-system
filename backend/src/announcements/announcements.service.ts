import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AnnouncementDto } from './announcements.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  /** All announcements, newest published first. Non-admins see active only. */
  async list(isAdmin = false) {
    return this.prisma.announcement.findMany({
      where: isAdmin ? {} : { active: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async create(userId: number, dto: AnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        title: (dto.title ?? '').trim(),
        message: (dto.message ?? '').trim(),
        active: dto.active ?? true,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        updatedBy: userId,
      },
    });
  }

  async update(id: number, userId: number, dto: AnnouncementDto) {
    const found = await this.prisma.announcement.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.message !== undefined ? { message: dto.message.trim() } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.publishedAt !== undefined ? { publishedAt: new Date(dto.publishedAt) } : {}),
        updatedBy: userId,
      },
    });
  }

  async remove(id: number) {
    await this.prisma.announcement.deleteMany({ where: { id } });
    return { ok: true };
  }
}
