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
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

  async insert(values: Omit<Row, 'id' | 'revokedAt'>) {
    await tick();
    this.rows.push({ id: this.nextId++, revokedAt: null, ...values });
  }

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

  it('issues a new access token and keeps the same refresh token', async () => {
    const session = await login();

    const refreshed = await service.refresh(session.refreshToken);

    expect(refreshed.tokens.refreshToken).toBe(session.refreshToken);
    expect(refreshed.tokens.accessToken).not.toBe(session.accessToken);
    expect(refreshed.user).toBe(user);
  });

  it('slides the session expiry forward on every refresh', async () => {
    const { refreshToken } = await login();
    const row = repo.rowFor(service, refreshToken);
    row.expiresAt = new Date(Date.now() + DAY_MS);

    await service.refresh(refreshToken);

    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 399 * DAY_MS);
  });

  it('lets any number of concurrent refreshes of one session succeed', async () => {
    const { refreshToken } = await login();

    const results = await Promise.all(
      Array.from({ length: 8 }, () => service.refresh(refreshToken)),
    );

    expect(results.every((r) => r.tokens.refreshToken === refreshToken)).toBe(
      true,
    );
    expect(repo.rowFor(service, refreshToken).revokedAt).toBeNull();
  });

  it('keeps working across many sequential refreshes', async () => {
    const { refreshToken } = await login();

    for (let i = 0; i < 20; i += 1) {
      await expect(service.refresh(refreshToken)).resolves.toBeDefined();
    }
  });

  it('rejects a logged-out session without touching the user’s other logins', async () => {
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

  it('rejects an expired session and does not revive it', async () => {
    const { refreshToken } = await login();
    const row = repo.rowFor(service, refreshToken);
    const expiredAt = new Date(Date.now() - 1000);
    row.expiresAt = expiredAt;

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      'Refresh token has expired',
    );
    expect(row.expiresAt).toBe(expiredAt);
  });

  it('rejects an unknown token', async () => {
    await expect(service.refresh('not-a-real-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
