import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SetAnnouncementDto {
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
