import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OperatingHoursService } from './operating-hours.service';
import { operationalRequestContext } from './operational-request-context';

describe('OperatingHoursService', () => {
  const make = (config: any) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(config),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue(config ? [config] : []),
    };
    const settings = { get: jest.fn().mockResolvedValue({ timezone: 'Asia/Kathmandu' }) };
    const outletAccess = { canAccessOutlet: jest.fn().mockResolvedValue(true) };
    const auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    return { service: new OperatingHoursService(repo as any, settings as any, outletAccess as any, auditLogs as any), repo, outletAccess, auditLogs };
  };

  afterEach(() => jest.useRealTimers());

  it('rejects equal opening and closing times', async () => {
    const { service } = make(null);
    await expect(service.update(1, { openingTime: '18:00', closingTime: '18:00', timezone: 'Asia/Kathmandu', enabled: true }, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('evaluates overnight hours across midnight', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const { service } = make({ outletId: 1, enabled: true, openingTime: '18:00', closingTime: '02:00', timezone: 'Asia/Kathmandu' });
    expect((await service.getStatus(1)).isOpen).toBe(false);
    jest.setSystemTime(new Date('2026-08-31T13:00:00Z')); // 18:45 Kathmandu
    expect((await service.getStatus(1)).isOpen).toBe(true);
    jest.setSystemTime(new Date('2026-09-01T01:00:00Z')); // 06:45 Kathmandu
    expect((await service.getStatus(1)).isOpen).toBe(false);
  });

  it('requires an exact authorized override header context', async () => {
    const { service, auditLogs } = make({ outletId: 1, enabled: true, openingTime: '18:00', closingTime: '02:00', timezone: 'Asia/Kathmandu' });
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T12:00:00Z'));
    await expect(service.assertOperational(1)).rejects.toBeInstanceOf(ForbiddenException);
    await operationalRequestContext.run({ userId: 9, isSuperadmin: true, overrideRequested: true, method: 'POST', path: '/orders', overrideAudited: false }, () => service.assertOperational(1));
    expect(auditLogs.record).toHaveBeenCalledTimes(1);
  });
});
