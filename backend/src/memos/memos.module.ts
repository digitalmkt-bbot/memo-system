import { Module } from '@nestjs/common';
import { MemosController } from './memos.controller';
import { MemosService } from './memos.service';
import { PdfService } from './pdf.service';

@Module({
  controllers: [MemosController],
  providers: [MemosService, PdfService],
})
export class MemosModule {}
