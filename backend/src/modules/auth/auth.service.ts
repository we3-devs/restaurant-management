import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { parseDurationToMs } from '../../common/utils/parse-duration';
import { AppConfig } from '../../config/configuration';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PoolMetrics } from '../../common/instrumentation/pool-metrics';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly auditLogsService: AuditLogsService,
    private readonly poolMetrics: PoolMetrics,
  ) {}

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const saltRounds = this.configService.get('bcrypt', { infer: true })!.saltRounds;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    await this.usersRepository.save(user);
  }

  async login(
    email: string,
    password: string,
    tenantSlug?: string,
  ): Promise<{ tokens: TokenPair; user: User }> {
    if (!tenantSlug?.trim()) {
      throw new UnauthorizedException('Tenant context is required to log in');
    }
    const loginStartUs = this.nowMicros();
    const phases: Record<string, number> = {};

    // Phase 1: User lookup
    const userLookupStartUs = this.nowMicros();
    const userQuery = this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .andWhere('user.is_superadmin = false');

    if (tenantSlug) {
      userQuery
        .innerJoin(
          'tenants',
          'login_tenant',
          'login_tenant.id = user.tenant_id AND LOWER(login_tenant.slug) = LOWER(:tenantSlug) AND login_tenant.is_active = true',
          { tenantSlug },
        );
    }

    const user = await userQuery.getOne();
    phases['userLookup'] = Math.round((this.nowMicros() - userLookupStartUs) / 1000);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Phase 2: Password verification
    const pwVerifyStartUs = this.nowMicros();
    const passwordMatch = await bcrypt.compare(password, user.password);
    phases['passwordVerify'] = Math.round((this.nowMicros() - pwVerifyStartUs) / 1000);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Phase 3: Token generation
    const tokenStartUs = this.nowMicros();
    const tokens = await this.issueTokenPair(user);
    phases['tokenGeneration'] = Math.round((this.nowMicros() - tokenStartUs) / 1000);

    const loginDurationMs = Math.round((this.nowMicros() - loginStartUs) / 1000);

    const phaseStr = Object.entries(phases)
      .map(([k, v]) => `${k}=${v}ms`)
      .join(' ');
    this.logger.log(
      `[PERF:LOGIN] email=${email} total=${loginDurationMs}ms (${phaseStr})`
    );

    void this.auditLogsService
      .record({
        userId: user.id,
        action: 'login',
        entityType: 'user',
        entityId: user.id,
      })
      .catch((error: Error) =>
        this.logger.error(`Audit write failed: ${error.message}`),
      );

    return { tokens, user };
  }

  private nowMicros(): number {
    const [seconds, nanos] = process.hrtime();
    return seconds * 1_000_000 + Math.round(nanos / 1_000);
  }

  /**
   * Issues a new access token for a refresh token. The refresh token is a
   * stable session credential, the way a long-lived login cookie works: it
   * keeps the same value for the whole session instead of being replaced on
   * every refresh. That leaves nothing for concurrent refreshes to race
   * over — any number of tabs, prefetches and Next.js instances can redeem
   * it at once and all succeed — which is what kept logging staff out while
   * it was rotated on every use. Each refresh pushes the expiry out again,
   * so a session only ends on logout or after refreshExpiresIn without use.
   */
  async refresh(
    rawRefreshToken: string,
  ): Promise<{ tokens: TokenPair; user: User }> {
    const tokenHash = this.hashToken(rawRefreshToken);

    // One conditional UPDATE both checks the session is still live
    // (unrevoked, unexpired) and slides its expiry forward.
    const renewed = await this.refreshTokensRepository.update(
      { tokenHash, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      { expiresAt: this.refreshTokenExpiry() },
    );

    const existing = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });
    if (!existing) {
      this.rejectRefresh('Invalid refresh token', 'unknown_token');
    }
    if (renewed.affected !== 1) {
      if (existing.revokedAt) {
        this.rejectRefresh(
          'Refresh token has been revoked',
          `revoked revokedAgoMs=${Date.now() - existing.revokedAt.getTime()}`,
          existing.userId,
        );
      }
      this.rejectRefresh(
        'Refresh token has expired',
        'expired',
        existing.userId,
      );
    }

    return {
      tokens: {
        accessToken: await this.signAccessToken(existing.user),
        refreshToken: rawRefreshToken,
      },
      user: existing.user,
    };
  }

  /** Logs why a refresh was refused (never any token material) and throws the 401. */
  private rejectRefresh(
    message: string,
    reason: string,
    userId?: number,
  ): never {
    this.logger.warn(
      `[AUTH:REFRESH_REJECTED] userId=${userId ?? 'unknown'} reason=${reason}`,
    );
    throw new UnauthorizedException(message);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const existing = await this.refreshTokensRepository.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
    if (!existing) return;

    await this.refreshTokensRepository.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    // Same fire-and-forget treatment as login() — see the comment there.
    void this.auditLogsService
      .record({
        userId: existing.userId,
        action: 'logout',
        entityType: 'user',
        entityId: existing.userId,
      })
      .catch((error: Error) =>
        this.logger.error(`Audit write failed: ${error.message}`),
      );
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    // A login starts a new session: a random refresh token that keeps this
    // value until logout or inactivity expiry (see refresh()).
    const rawRefreshToken = randomBytes(48).toString('hex');

    // .insert() instead of .create()+.save(): same entity listeners/
    // subscribers run either way (TypeORM's InsertQueryBuilder calls them
    // regardless — see callListeners, on by default), but .insert() skips
    // the transaction .save() wraps a single new entity in (useTransaction
    // defaults to false for .insert(), true for .save()), cutting 3 network
    // round trips down to 1 on this remote DB.
    const [accessToken] = await Promise.all([
      this.signAccessToken(user),
      this.refreshTokensRepository.insert({
        userId: user.id,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt: this.refreshTokenExpiry(),
      }),
    ]);
    return { accessToken, refreshToken: rawRefreshToken };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, email: user.email });
  }

  /** When a session used now should expire: refreshExpiresIn from now (sliding). */
  private refreshTokenExpiry(): Date {
    const refreshExpiresIn = this.configService.get('jwt', {
      infer: true,
    })!.refreshExpiresIn;
    return new Date(Date.now() + parseDurationToMs(refreshExpiresIn));
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
