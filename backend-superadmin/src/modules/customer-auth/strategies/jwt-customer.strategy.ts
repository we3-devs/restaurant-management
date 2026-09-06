import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../config/configuration';
import { CustomerJwtPayload } from '../types/customer-jwt-payload';

@Injectable()
export class JwtCustomerStrategy extends PassportStrategy(
  Strategy,
  'jwt-customer',
) {
  constructor(configService: ConfigService<AppConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true })!.accessSecret,
    });
  }

  validate(payload: CustomerJwtPayload): CustomerJwtPayload {
    if (payload.type !== 'customer' && payload.type !== 'guest') {
      throw new UnauthorizedException('Invalid customer session');
    }
    return payload;
  }
}
