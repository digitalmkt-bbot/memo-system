import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AnnouncementDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() fileData?: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() fileType?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() publishedAt?: string;
}
