import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementDto } from './announcements.dto';

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private svc: AnnouncementsService) {}

  // any authenticated user reads the news feed (admins also see hidden ones)
  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user?.role === 'admin');
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Req() req: any, @Body() dto: AnnouncementDto) {
    return this.svc.create(req.user.id, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: AnnouncementDto) {
    return this.svc.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
