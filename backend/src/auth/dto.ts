import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

export class RegisterDto {
  @IsInt() companyId: number;
  @IsOptional() @IsInt() departmentId?: number;
  @IsString() employeeCode: string;
  @IsString() name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsIn(['staff', 'manager', 'executive', 'admin']) role: string;
  @IsOptional() @IsInt() managerId?: number;
}
