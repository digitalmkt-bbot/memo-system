import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnnouncementsService } from './announcements.service';
import { SetAnnouncementDto } from './announcements.dto';

@Controller('announcement')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private svc: AnnouncementsService) {}

  // any authenticated user can read the current announcement
  @Get()
  current() {
    return this.svc.current();
  }

  // only admins can set it
  @Put()
  @UseGuards(RolesGuard)
  @Roles('admin')
  set(@Req() req: any, @Body() dto: SetAnnouncementDto) {
    return this.svc.set(req.user.id, dto);
  }
}
