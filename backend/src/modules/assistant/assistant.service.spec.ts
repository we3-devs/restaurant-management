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
    expect(classifyAssistantIntent("show me today's orders")).toBe(
      'orderDetails',
    );
    expect(classifyAssistantIntent('order details')).toBe('orderDetails');
  });

  it('routes best-seller questions to topSelling, not menu/revenue', () => {
    expect(classifyAssistantIntent('top selling item today')).toBe(
      'topSelling',
    );
    expect(classifyAssistantIntent('what is our best seller')).toBe(
      'topSelling',
    );
    expect(classifyAssistantIntent('most popular dish this week')).toBe(
      'topSelling',
    );
    expect(classifyAssistantIntent('highest selling item')).toBe(
      'topSelling',
    );
  });
});