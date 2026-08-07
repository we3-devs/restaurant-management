import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { parseDurationToMs } from '../../common/utils/parse-duration';
import { AppConfig } from '../../config/configuration';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
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

  async login(
    email: string,
    password: string,
  ): Promise<{ tokens: TokenPair; user: User }> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user);

    // Fire-and-forget, matching AuditInterceptor's pattern for every other
    // mutating route — the response doesn't depend on the audit row being
    // committed, so there's no reason to block login on it.
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

  async refresh(
    rawRefreshToken: string,
  ): Promise<{ tokens: TokenPair; user: User }> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const existing = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated token: possible theft. Revoke the whole chain for this user.
      await this.refreshTokensRepository.update(
        { userId: existing.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Refresh token has already been used');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const tokens = await this.issueTokenPair(existing.user);
    existing.revokedAt = new Date();
    existing.replacedByTokenHash = this.hashToken(tokens.refreshToken);
    await this.refreshTokensRepository.save(existing);

    return { tokens, user: existing.user };
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
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      isSuperadmin: user.isSuperadmin,
    });

    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshExpiresIn = this.configService.get('jwt', {
      infer: true,
    })!.refreshExpiresIn;

    // .insert() instead of .create()+.save(): same entity listeners/
    // subscribers run either way (TypeORM's InsertQueryBuilder calls them
    // regardless — see callListeners, on by default), but .insert() skips
    // the transaction .save() wraps a single new entity in (useTransaction
    // defaults to false for .insert(), true for .save()), cutting 3 network
    // round trips down to 1 on this remote DB.
    await this.refreshTokensRepository.insert({
      userId: user.id,
      tokenHash: this.hashToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + parseDurationToMs(refreshExpiresIn)),
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
