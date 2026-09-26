import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash, createHmac } from 'crypto';
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

/**
 * How long after a refresh token is rotated a replay of it still counts as a
 * duplicate of that same rotation (a concurrent refresh from another Next.js
 * runtime/instance, or a retry after the rotating response never reached the
 * browser) rather than reuse of a stale, possibly stolen token.
 */
const ROTATION_GRACE_MS = 60_000;
/** Successor hops a replay inside the grace window may follow to reach the live token. */
const MAX_GRACE_HOPS = 5;

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

  async refresh(
    rawRefreshToken: string,
  ): Promise<{ tokens: TokenPair; user: User }> {
    const tokenHash = this.hashToken(rawRefreshToken);
    // The successor is derived from the presented token instead of being
    // random, so every request that redeems the same token — however many
    // there are, in whatever order they land — is handed the exact same new
    // refresh token. Several Next.js runtimes/instances refresh
    // independently (proxy.ts ahead of a render, every /api/backend route
    // handler on a 401) and can't dedupe against each other; with random
    // successors each duplicate forked the chain, the browser kept whichever
    // Set-Cookie happened to land last, and the next refresh with a
    // forked-off token tripped reuse detection and logged the user out.
    const successorToken = this.successorRefreshToken(rawRefreshToken);
    const successorHash = this.hashToken(successorToken);

    // Atomic conditional UPDATE is the rotation gate: only the request that
    // flips revokedAt from NULL here "wins" the rotation. It records the
    // successor link in the same statement, so a duplicate arriving before
    // the winner has inserted the successor row can already tell this was a
    // rotation rather than a logout or a revoked family.
    const claim = await this.refreshTokensRepository.update(
      { tokenHash, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      { revokedAt: new Date(), replacedByTokenHash: successorHash },
    );

    const existing = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (claim.affected === 1) {
      await this.insertRefreshToken(existing.userId, successorHash);
      return {
        tokens: {
          accessToken: await this.signAccessToken(existing.user),
          refreshToken: successorToken,
        },
        user: existing.user,
      };
    }

    if (existing.revokedAt === null) {
      // Still unrevoked, so the claim only failed on its expiry condition.
      throw new UnauthorizedException('Refresh token has expired');
    }

    const rotatedHere = existing.replacedByTokenHash === successorHash;
    const withinGrace =
      Date.now() - existing.revokedAt.getTime() < ROTATION_GRACE_MS;

    if (rotatedHere && withinGrace) {
      // A duplicate of a rotation that just happened. The winner may still
      // be between its claim and its insert, so make sure the successor row
      // exists (idempotent), then hand back the family's live token.
      await this.insertRefreshToken(existing.userId, successorHash);
      let candidate = successorToken;
      for (let hop = 0; hop < MAX_GRACE_HOPS; hop += 1) {
        const current = await this.refreshTokensRepository.findOne({
          where: { tokenHash: this.hashToken(candidate) },
        });
        if (!current) break;
        if (current.revokedAt === null) {
          if (current.expiresAt.getTime() < Date.now()) break;
          return {
            tokens: {
              accessToken: await this.signAccessToken(existing.user),
              refreshToken: candidate,
            },
            user: existing.user,
          };
        }
        // Rotated again within the window: follow it. Anything else (logout,
        // revoked family) means there's no live session left to return.
        const next = this.successorRefreshToken(candidate);
        if (current.replacedByTokenHash !== this.hashToken(next)) break;
        candidate = next;
      }
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (existing.replacedByTokenHash) {
      // Rotated long ago and presented again: genuine reuse of a stale token
      // — possible theft. Revoke this login's token family. The same
      // account's logins on other devices were not exposed by this token,
      // so they stay up.
      await this.revokeTokenFamily(tokenHash);
      throw new UnauthorizedException('Refresh token has already been used');
    }

    // Revoked without a successor: logged out, or its family was already
    // revoked. Nothing further to revoke.
    throw new UnauthorizedException('Refresh token has been revoked');
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
    // A login starts a new token family from a random token; refresh()
    // derives every later token in the family from its predecessor.
    const rawRefreshToken = randomBytes(48).toString('hex');
    const [accessToken] = await Promise.all([
      this.signAccessToken(user),
      this.insertRefreshToken(user.id, this.hashToken(rawRefreshToken)),
    ]);
    return { accessToken, refreshToken: rawRefreshToken };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, email: user.email });
  }

  /** Inserts a refresh token row, or does nothing if that hash already exists (a duplicate of the same rotation got there first). */
  private async insertRefreshToken(
    userId: number,
    tokenHash: string,
  ): Promise<void> {
    const refreshExpiresIn = this.configService.get('jwt', {
      infer: true,
    })!.refreshExpiresIn;

    // A single INSERT instead of .create()+.save(): same entity listeners/
    // subscribers run either way (TypeORM's InsertQueryBuilder calls them
    // regardless — see callListeners, on by default), but it skips the
    // transaction .save() wraps a single new entity in, cutting 3 network
    // round trips down to 1 on this remote DB.
    await this.refreshTokensRepository
      .createQueryBuilder()
      .insert()
      .into(RefreshToken)
      .values({
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + parseDurationToMs(refreshExpiresIn)),
      })
      .orIgnore()
      .execute();
  }

  /** Revokes the given token and every token rotated from it, following the replaced_by links in one statement. */
  private async revokeTokenFamily(tokenHash: string): Promise<void> {
    await this.refreshTokensRepository.query(
      `WITH RECURSIVE family AS (
         SELECT id, replaced_by_token_hash FROM refresh_tokens WHERE token_hash = $1
         UNION
         SELECT rt.id, rt.replaced_by_token_hash
         FROM refresh_tokens rt
         JOIN family f ON rt.token_hash = f.replaced_by_token_hash
       )
       UPDATE refresh_tokens
       SET revoked_at = $2, updated_at = $2
       WHERE id IN (SELECT id FROM family) AND revoked_at IS NULL`,
      [tokenHash, new Date()],
    );
  }

  /**
   * The next refresh token in a family: an HMAC of the current raw token.
   * Only the server can compute it (the key never leaves the backend), and
   * the DB only ever stores SHA-256 hashes, so neither a stolen stale token
   * nor a DB leak is enough to derive a live one.
   */
  private successorRefreshToken(rawToken: string): string {
    const secret = this.configService.get('jwt', { infer: true })!.accessSecret;
    return createHmac('sha256', secret)
      .update(`refresh-token-rotation:${rawToken}`)
      .digest('hex');
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
