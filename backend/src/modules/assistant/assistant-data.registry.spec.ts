import {
  assertAssistantDataAccess,
  ASSISTANT_BLOCKED_TABLES,
  validateAssistantRegistry,
} from './assistant-data.registry';

describe('assistant data registry', () => {
  it('has a table allow-list and only known read permissions for every intent', () => {
    expect(() => validateAssistantRegistry()).not.toThrow();
  });

  it('blocks protected system tables', () => {
    expect(() => assertAssistantDataAccess('inventory', ['users'])).toThrow(
      'Blocked table',
    );
    expect(ASSISTANT_BLOCKED_TABLES.has('users')).toBe(true);
  });

  it('allows intended business tables', () => {
    expect(() =>
      assertAssistantDataAccess('inventory', ['ingredients', 'warehouses']),
    ).not.toThrow();
  });

  it('rejects tables outside the allowed set for an intent', () => {
    expect(() => assertAssistantDataAccess('menu', ['users'])).toThrow(
      'Blocked table access',
    );
  });
});
