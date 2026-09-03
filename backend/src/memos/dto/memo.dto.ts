import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMemoDto {
  @IsInt() companyId: number;
  @IsInt() departmentId: number;
  @IsString() @MinLength(1) fromName: string;
  @IsString() @MinLength(1) subject: string;
  @IsOptional() @IsString() attachment?: string;
  @IsString() @MinLength(1) detail: string;
  @IsOptional() @IsBoolean() vat?: boolean;
  @IsOptional() @IsNumber() discount?: number;
  @IsOptional() @IsString() editNote?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() categoryNote?: string;
  @IsOptional() @IsString() neededDate?: string;
  @IsOptional() @IsString() expenseDate?: string;
  @IsOptional() @IsString() backdateReason?: string;
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
  @IsOptional() @IsNumber() discount?: number;
  @IsOptional() @IsString() editNote?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() categoryNote?: string;
  @IsOptional() @IsString() neededDate?: string;
  @IsOptional() @IsString() expenseDate?: string;
  @IsOptional() @IsString() backdateReason?: string;
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

export class SettleDto {
  @IsOptional() @IsNumber() actualAmount?: number;
  @IsOptional() @IsArray() actualItems?: any[];
}

export class SubstituteDto {
  @IsOptional() @IsString() buyer?: string;
  @IsOptional() @IsString() payerName?: string;
  @IsOptional() @IsString() payerRole?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() signName?: string;
  @IsOptional() @IsArray() items?: any[];
  @IsOptional() @IsBoolean() forward?: boolean; // also re-send the close (ส่งปิดงาน)
}
