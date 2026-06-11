import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MemosService } from './memos.service';
import { PdfService } from './pdf.service';
import { ActionDto, CreateMemoDto, UpdateMemoDto } from './dto/memo.dto';

@Controller('memos')
@UseGuards(JwtAuthGuard)
export class MemosController {
  constructor(private svc: MemosService, private pdf: PdfService) {}

  @Get()
  list(@Req() req: any, @Query() q: any) { return this.svc.list(req.user, q); }

  @Get(':id')
  getOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.svc.getOne(req.user, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateMemoDto) { return this.svc.create(req.user, dto); }

  @Put(':id')
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMemoDto) { return this.svc.update(req.user, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.svc.remove(req.user, id); }

  @Post(':id/submit')
  submit(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.svc.submit(req.user, id); }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: ActionDto) { return this.svc.approve(req.user, id, dto.comment); }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: ActionDto) { return this.svc.reject(req.user, id, dto.comment); }

  // Inline A4 PDF
  @Get(':id/pdf')
  async pdfInline(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { memo, approvals } = await this.svc.getOne(req.user, id);
    const buf = await this.pdf.render({ memo, approvals });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${memo.memoNo || 'memo'}.pdf"` });
    res.send(buf);
  }

  // Generate PDF and return a URL (S3 once wired; for now points at the inline GET endpoint)
  @Post(':id/pdf')
  async pdfGenerate(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.svc.getOne(req.user, id); // authorization + existence check
    const base = process.env.APP_URL || '';
    return { url: `${base}/memos/${id}/pdf` };
  }
}
