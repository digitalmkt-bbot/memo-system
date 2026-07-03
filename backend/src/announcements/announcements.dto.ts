import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AnnouncementDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() publishedAt?: string;
}
