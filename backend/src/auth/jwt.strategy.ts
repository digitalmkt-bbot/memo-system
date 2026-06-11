import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtUser {
  id: number;
  role: string;
  companyId: number;
  departmentId: number | null;
  name: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change-me-in-production',
    });
  }

  async validate(payload: any): Promise<JwtUser> {
    return {
      id: payload.sub,
      role: payload.role,
      companyId: payload.companyId,
      departmentId: payload.departmentId ?? null,
      name: payload.name,
    };
  }
}
