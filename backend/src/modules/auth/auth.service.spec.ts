import { UnauthorizedException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AuthService, TokenPair } from './auth.service';

interface Row {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
}

/** Yields to the event loop so concurrent refresh() calls interleave between DB calls the way real round trips do. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key as keyof Row];
    if (expected instanceof FindOperator) {
      if (expected.type === 'isNull') return actual === null;
      if (expected.type === 'moreThan')
        return (actual as Date).getTime() > (expected.value as Date).getTime();
      throw new Error(`Unsupported operator ${expected.type}`);
    }
    return actual === expected;
  });
}

/** In-memory stand-in for Repository<RefreshToken>, covering exactly the calls AuthService makes. */
class FakeRefreshTokenRepository {
  rows: Row[] = [];
  private nextId = 1;

  constructor(private readonly users: Map<number, User>) {}

  async update(where: Record<string, unknown>, patch: Partial<Row>) {
    await tick();
    const hits = this.rows.filter((row) => matches(row, where));
    hits.forEach((row) => Object.assign(row, patch));
    return { affected: hits.length };
  }

  async findOne({
    where,
    relations,
  }: {
    where: Record<string, unknown>;
    relations?: { user?: boolean };
  }) {
    await tick();
    const row = this.rows.find((candidate) => matches(candidate, where));
    if (!row) return null;
    return {
      ...row,
      ...(relations?.user ? { user: this.users.get(row.userId) } : {}),
    };
  }

  createQueryBuilder() {
    let values: Omit<Row, 'id' | 'revokedAt' | 'replacedByTokenHash'>;
    const builder = {
      insert: () => builder,
      into: () => builder,
      values: (v: typeof values) => {
        values = v;
        return builder;
      },
      orIgnore: () => builder,
      execute: async () => {
        await tick();
        if (this.rows.some((row) => row.tokenHash === values.tokenHash)) return;
        this.rows.push({
          id: this.nextId++,
          revokedAt: null,
          replacedByTokenHash: null,
          ...values,
        });
      },
    };
    return builder;
  }

  async query(sql: string, [tokenHash, revokedAt]: [string, Date]) {
    await tick();
    if (!sql.includes('WITH RECURSIVE'))
      throw new Error(`Unexpected query: ${sql}`);
    let hash: string | null = tokenHash;
    while (hash) {
      const row = this.rows.find((candidate) => candidate.tokenHash === hash);
      if (!row) break;
      if (row.revokedAt === null) row.revokedAt = revokedAt;
      hash = row.replacedByTokenHash;
    }
  }

  live(): Row[] {
    return this.rows.filter((row) => row.revokedAt === null);
  }

  rowFor(service: AuthService, rawToken: string): Row {
    const row = this.rows.find(
      (candidate) => candidate.tokenHash === service['hashToken'](rawToken),
    );
    if (!row) throw new Error('No row for token');
    return row;
  }
}

describe('AuthService.refresh', () => {
  const user = { id: 7, email: 'waiter@example.com' } as User;
  let repo: FakeRefreshTokenRepository;
  let service: AuthService;
  let signed = 0;

  const login = (): Promise<TokenPair> => service['issueTokenPair'](user);

  beforeEach(() => {
    signed = 0;
    repo = new FakeRefreshTokenRepository(new Map([[user.id, user]]));
    const jwtService = {
      signAsync: jest.fn(() => Promise.resolve(`access-${++signed}`)),
    };
    const configService = {
      get: (key: string) =>
        key === 'jwt'
          ? {
              accessSecret: 'test-secret',
              accessExpiresIn: '15m',
              refreshExpiresIn: '400d',
            }
          : undefined,
    };
    service = new AuthService(
      {} as never,
      repo as never,
      jwtService as never,
      configService as never,
      { record: jest.fn(() => Promise.resolve()) } as never,
      {} as never,
    );
  });

  it('rotates the token, and the replacement keeps working', async () => {
    const { refreshToken } = await login();

    const first = await service.refresh(refreshToken);
    expect(first.tokens.refreshToken).not.toBe(refreshToken);
    expect(first.user).toBe(user);

    const second = await service.refresh(first.tokens.refreshToken);
    expect(second.tokens.refreshToken).not.toBe(first.tokens.refreshToken);
    expect(repo.live().map((row) => row.tokenHash)).toEqual([
      service['hashToken'](second.tokens.refreshToken),
    ]);
  });

  it('hands every concurrent redeemer of the same token the same replacement', async () => {
    const { refreshToken } = await login();

    const results = await Promise.all(
      Array.from({ length: 6 }, () => service.refresh(refreshToken)),
    );

    const refreshTokens = new Set(
      results.map((result) => result.tokens.refreshToken),
    );
    expect(refreshTokens.size).toBe(1);
    // Each caller still gets its own access token.
    expect(
      new Set(results.map((result) => result.tokens.accessToken)).size,
    ).toBe(6);
    const [replacement] = refreshTokens;
    expect(repo.live().map((row) => row.tokenHash)).toEqual([
      service['hashToken'](replacement),
    ]);

    // Whichever Set-Cookie the browser kept, the next refresh still works.
    await expect(service.refresh(replacement)).resolves.toBeDefined();
  });

  it('returns the family’s newest token to a late duplicate after it rotated again', async () => {
    const { refreshToken } = await login();
    const first = await service.refresh(refreshToken);
    const second = await service.refresh(first.tokens.refreshToken);

    const late = await service.refresh(refreshToken);

    expect(late.tokens.refreshToken).toBe(second.tokens.refreshToken);
    expect(repo.live()).toHaveLength(1);
  });

  it('treats a replay outside the grace window as reuse and revokes only that login’s family', async () => {
    const otherDevice = await login();
    const { refreshToken } = await login();
    const rotated = await service.refresh(refreshToken);
    repo.rowFor(service, refreshToken).revokedAt = new Date(
      Date.now() - 5 * 60_000,
    );

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      'Refresh token has already been used',
    );

    await expect(service.refresh(rotated.tokens.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      service.refresh(otherDevice.refreshToken),
    ).resolves.toBeDefined();
  });

  it('rejects a logged-out token without touching the user’s other logins', async () => {
    const otherDevice = await login();
    const { refreshToken } = await login();
    await service.logout(refreshToken);

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      'Refresh token has been revoked',
    );
    await expect(
      service.refresh(otherDevice.refreshToken),
    ).resolves.toBeDefined();
  });

  it('rejects an expired token without rotating it', async () => {
    const { refreshToken } = await login();
    const row = repo.rowFor(service, refreshToken);
    row.expiresAt = new Date(Date.now() - 1000);

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      'Refresh token has expired',
    );
    expect(row.revokedAt).toBeNull();
    expect(repo.rows).toHaveLength(1);
  });

  it('rejects an unknown token', async () => {
    await expect(service.refresh('not-a-real-token')).rejects.toThrow(
      'Invalid refresh token',
    );
  });
});
