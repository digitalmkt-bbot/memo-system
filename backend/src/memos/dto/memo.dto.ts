import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMemoDto {
  @IsInt() companyId: number;
  @IsInt() departmentId: number;
  @IsString() @MinLength(1) fromName: string;
  @IsString() @MinLength(1) subject: string;
  @IsOptional() @IsString() attachment?: string;
  @IsString() @MinLength(1) detail: string;
  @IsOptional() @IsBoolean() vat?: boolean;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() categoryNote?: string;
  @IsOptional() @IsString() neededDate?: string;
  @IsOptional() @IsArray() items?: any[];
}

export class UpdateMemoDto {
  @IsOptional() @IsInt() companyId?: number;
  @IsOptional() @IsInt() departmentId?: number;
  @IsOptional() @IsString() fromName?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() attachment?: string;
  @IsOptional() @IsString() detail?: string;
  @IsOptional() @IsBoolean() vat?: boolean;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() categoryNote?: string;
  @IsOptional() @IsString() neededDate?: string;
  @IsOptional() @IsArray() items?: any[];
}

export class ActionDto {
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsString() next?: string;
  @IsOptional() @IsInt() approverId?: number;
}

export class ForwardDto {
  @IsArray() recipients: string[];
}
