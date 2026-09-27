import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { isAccountDeactivated } from '../account-status';
import { AppConfig } from '../../../config/configuration';
import { User } from '../../users/entities/user.entity';

export interface JwtAccessPayload {
  sub: number;
  email: string;
  /** Session (refresh token row) this access token was issued for; absent on tokens minted before sessions carried an id. */
  sid?: number;
}

// Profiling showed this lookup runs on every single authenticated request
// and costs ~150-200ms against the remote DB — a fixed tax on top of
// whatever the handler itself needs. Caching it trades a short revocation-
// propagation delay (a deactivated/deleted user can keep working for up to
// this long) for removing that tax from nearly all requests. The same delay
// applies to deactivation, which is checked alongside the lookup.
const USER_CACHE_TTL_MS = 15_000;

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<AppConfig>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true })!.accessSecret,
      passReqToCallback: true,
    });
  }

  async validate(
    request: AuthenticatedRequest,
    payload: JwtAccessPayload,
  ): Promise<User> {
    request.sessionId = payload.sid;

    const cacheKey = `auth:user:${payload.sub}`;
    const cached = await this.cache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    const [user, deactivated] = await Promise.all([
      this.usersRepository.findOne({ where: { id: payload.sub } }),
      isAccountDeactivated(this.usersRepository.manager, payload.sub),
    ]);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (deactivated) {
      throw new UnauthorizedException('This account has been deactivated');
    }
    await this.cache.set(cacheKey, user, USER_CACHE_TTL_MS);
    return user;
  }
}
