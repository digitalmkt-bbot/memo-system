import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

const ROLES = ['staff', 'manager', 'executive', 'admin', 'hrm', 'md', 'fc'];

export class UpdateUserDto {
  @IsOptional() @IsInt() companyId?: number;
  @IsOptional() @IsInt() departmentId?: number;
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsIn(ROLES) role?: string;
  @IsOptional() @IsInt() managerId?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
