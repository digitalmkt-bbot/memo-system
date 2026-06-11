import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DepartmentsService } from './departments.service';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private svc: DepartmentsService) {}
  @Get()
  findAll(@Query('companyId') companyId?: string) {
    return this.svc.findAll(companyId ? parseInt(companyId, 10) : undefined);
  }
}
