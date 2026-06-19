import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, Res,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  approve(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: ActionDto) { return this.svc.approve(req.user, id, dto.comment, dto.next); }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: ActionDto) { return this.svc.reject(req.user, id, dto.comment); }

  // ---- Attachments ----
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadAttachment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.addAttachment(req.user, id, file as any);
  }

  @Get(':id/attachments')
  listAttachments(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.svc.listAttachments(req.user, id);
  }

  @Get(':id/attachments/:attId')
  async downloadAttachment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('attId', ParseIntPipe) attId: number,
    @Res() res: Response,
  ) {
    const att = await this.svc.getAttachment(req.user, id, attId);
    res.set({
      'Content-Type': att.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename)}"`,
    });
    res.send(Buffer.from(att.data as any));
  }

  @Delete(':id/attachments/:attId')
  deleteAttachment(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Param('attId', ParseIntPipe) attId: number) {
    return this.svc.deleteAttachment(req.user, id, attId);
  }

  // ---- PDF ----
  @Get(':id/pdf')
  async pdfInline(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { memo, approvals } = await this.svc.getOne(req.user, id);
    const buf = await this.pdf.render({ memo, approvals });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${memo.memoNo || 'memo'}.pdf"` });
    res.send(buf);
  }

  @Post(':id/pdf')
  async pdfGenerate(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.svc.getOne(req.user, id);
    const base = process.env.APP_URL || '';
    return { url: `${base}/memos/${id}/pdf` };
  }
}
