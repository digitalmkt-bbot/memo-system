import { SetMetadata } from '@nestjs/common';

export type Role = 'staff' | 'manager' | 'executive' | 'admin' | 'hrm' | 'md' | 'fc' | 'owner';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
