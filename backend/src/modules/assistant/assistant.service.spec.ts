import { classifyAssistantIntent } from './assistant.service';

describe('classifyAssistantIntent', () => {
  it('keeps a bare order request as an order count', () => {
    expect(classifyAssistantIntent('order')).toBe('orderDetails');
  });

  it('routes natural order-detail questions to order data', () => {
    expect(classifyAssistantIntent('what was order')).toBe('orderDetails');
    expect(classifyAssistantIntent('which orders did we have today')).toBe(
      'orderDetails',
    );
  });
});