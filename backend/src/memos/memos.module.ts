import { Module } from '@nestjs/common';
import { MemosController } from './memos.controller';
import { MemosService } from './memos.service';
import { PdfService } from './pdf.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [MemosController],
  providers: [MemosService, PdfService],
})
export class MemosModule {}
