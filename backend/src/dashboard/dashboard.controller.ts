import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private svc: DashboardService) {}

  @Get('summary')
  summary(@Req() req: any) { return this.svc.summary(req.user); }

  @Get('monthly')
  monthly(@Req() req: any, @Query('companyId') companyId?: string) { return this.svc.monthly(req.user, companyId); }

  @Get('company')
  byCompany(@Req() req: any) { return this.svc.byCompany(req.user); }

  @Get('department')
  byDept(@Req() req: any) { return this.svc.byDepartment(req.user); }
}
