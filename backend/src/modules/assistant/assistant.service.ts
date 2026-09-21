import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../common/tenant/tenant-context';
import {
  OutletAccessService,
  ALL_OUTLETS,
} from '../auth/outlet-access.service';
import { PermissionsService } from '../auth/permissions.service';
import { User } from '../users/entities/user.entity';
import {
  ASSISTANT_SYSTEM_PROMPT,
  ASSISTANT_PERMISSION,
} from './assistant.constants';
import {
  ASSISTANT_DATA_PERMISSIONS,
  assertAssistantDataAccess,
} from './assistant-data.registry';

type Route = 'DATA' | 'INSIGHT' | 'CHAT';
type DataIntent =
  | 'occupancy'
  | 'inventory'
  | 'menu'
  | 'staffSummary'
  | 'payments'
  | 'serviceIssues'
  | 'cancellations'
  | 'bookings'
  | 'customers'
  | 'revenue'
  | 'orderDetails'
  | 'overview';
type AnalyticsPlan = {
  intent: DataIntent | 'conversation';
  period: 'today' | 'yesterday' | 'dayBeforeYesterday' | '7d' | '30d';
  groupBy?: 'day' | 'type';
};

export function classifyAssistantIntent(
  question: string,
): DataIntent | 'conversation' {
  const q = question.trim().toLowerCase();
  if (!q) return 'conversation';

  if (/^orders?$/.test(q)) return 'orderDetails';

  const casualGreeting =
    /^(hi|hello|hey|hii|hiii|hloo|yo|sup|bro|broo|namaste|good\s+(morning|afternoon|evening)|how\s+are\s+you|what\s*['’]s\s+up|whats\s+up|hey\s+there|hi\s+there)$/i;
  if (casualGreeting.test(q) || q.length <= 5) return 'conversation';

  if (
    /inventory|stock|ingredient|items?\s+(in|available)|available\s+items?/.test(
      q,
    )
  )
    return 'inventory';
  if (/menu|food|dish|dishes|recipe/.test(q)) return 'menu';
  if (/staff|employee|employees|team member/.test(q)) return 'staffSummary';
  if (/payment|payments|cash|card|refund/.test(q)) return 'payments';
  if (
    /my\s+order|order.*(going|status|ready|progress|where|done|placed|made)|any\s+orders?|have\s+we\s+(done|made|placed)|(?:what|which)\s+(?:was|were|is|are)?\s*(?:the\s+)?orders?|order\s+(detail|details|list|number)|list\s+orders|individual\s+orders|show.*orders/.test(
      q,
    )
  )
    return 'orderDetails';
  if (
    /table|tables|occupancy|seating|occupied|available\s+tables?|vacant|free\s+tables?/.test(
      q,
    )
  )
    return 'occupancy';
  if (/complaint|issue|grievance|service request/.test(q))
    return 'serviceIssues';
  if (/cancel/.test(q)) return 'cancellations';
  if (/booking|reservation/.test(q)) return 'bookings';
  if (/customer|guest/.test(q)) return 'customers';
  if (/revenue|sales|earning|income|bikri/.test(q)) return 'revenue';
  if (
    /summary|overview|overall|business\s+(status|health)|today|yesterday|last\s+(7|30)\s+days|this\s+(week|month)/.test(
      q,
    )
  )
    return 'overview';

  return 'conversation';
}

function formatOrderAnswer(
  question: string,
  metrics: unknown,
  period: string,
): string {
  if (/^orders?$/.test(question.trim().toLowerCase())) {
    const count = Number((metrics as { orders?: unknown })?.orders ?? 0);
    return `${period === 'today' ? 'Today' : period}, we had ${count} order${count === 1 ? '' : 's'}.`;
  }

  const orders = Array.isArray(metrics)
    ? (metrics as Array<Record<string, unknown>>)
    : [];
  if (orders.length === 0) return `There were no orders for ${period}.`;

  const lines = orders.map((order) => {
    const orderNumber = String(
      order.orderNumber ?? order.billNumber ?? 'unnumbered',
    );
    const items = Array.isArray(order.items)
      ? (order.items as Array<{ name?: unknown; quantity?: unknown }>)
          .map(
            (item) =>
              `${String(item.name ?? 'Item')} x${String(item.quantity ?? 0)}`,
          )
          .join(', ')
      : 'No item details';
    const total =
      order.grandTotal === null || order.grandTotal === undefined
        ? ''
        : `, total Rs. ${String(order.grandTotal)}`;
    return `- Order ${orderNumber}: ${items}; status ${String(order.status ?? 'unknown')}${total}`;
  });
  return `${period[0].toUpperCase()}${period.slice(1)}'s orders (${orders.length}):\n${lines.join('\n')}`;
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly db: DataSource,
    private readonly access: OutletAccessService,
    private readonly permissions: PermissionsService,
    private readonly config: ConfigService,
    private readonly tenantContext: TenantContext,
  ) {}
  private async assertAssistantAccess(user: User) {
    if (!(await this.permissions.hasPermission(user.id, ASSISTANT_PERMISSION)))
      throw new ForbiddenException(
        'You do not have permission to use the operations assistant',
      );
  }
  private requireTenant(): number {
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId === null)
      throw new ForbiddenException(
        'A tenant context is required for the restaurant assistant',
      );
    return tenantId;
  }
  private async restaurantContext(): Promise<{ name: string }> {
    const tenantId = this.requireTenant();
    const rows = (await this.db.query(
      'SELECT name FROM tenants WHERE id = $1 AND is_active = true LIMIT 1',
      [tenantId],
    )) as Array<{ name: string }>;
    if (!rows[0])
      throw new ForbiddenException(
        'The current restaurant tenant could not be found',
      );
    return { name: rows[0].name };
  }
  private async ids(user: User, outletId?: number): Promise<number[]> {
    const tenantId = this.requireTenant();
    const tenantOutlets = (
      (await this.db.query(
        'SELECT id FROM outlets WHERE tenant_id = $1 ORDER BY id',
        [tenantId],
      )) as Array<{ id: string | number }>
    ).map((row) => Number(row.id));
    const outlets = await this.access.getAccessibleOutletIds(user.id);
    if (outletId !== undefined) {
      await this.access.assertOutletAccess(user.id, outletId);
      if (!tenantOutlets.includes(outletId))
        throw new ForbiddenException(
          'The selected outlet is outside the current tenant',
        );
      return [outletId];
    }
    if (outlets !== ALL_OUTLETS && outlets.length === 0)
      throw new ForbiddenException('You do not have access to any outlet');
    if (outlets === ALL_OUTLETS) return tenantOutlets;
    return tenantOutlets.filter((id) => outlets.includes(id));
  }
  private async assertIntentAccess(
    user: User,
    intent: DataIntent | 'conversation',
  ): Promise<void> {
    if (intent === 'conversation') return;
    const permissionSets = ASSISTANT_DATA_PERMISSIONS[intent];
    const granted = await this.permissions.getPermissionSlugs(user.id);
    if (
      !permissionSets.some((set) =>
        set.every((permission) => granted.has(permission)),
      )
    )
      throw new ForbiddenException(
        `You do not have permission to ask about ${intent}`,
      );
  }
  private async llm(question: string, context: unknown) {
    const key =
      this.config.get<string>('GROQ_API_KEY') || process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not configured');
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 700,
          messages: [
            { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Q: ${question}\nData: ${JSON.stringify(context)}`,
            },
          ],
        }),
      },
    );
    if (!response.ok) {
      // Groq's error body (e.g. "model_decommissioned", "invalid_api_key")
      // is what actually explains a 4xx/5xx here — the status code alone
      // sent us on a manual-reproduction goose chase last time this fired.
      const body = await response.text().catch(() => '');
      throw new Error(
        `LLM request failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }
    const answer = (
      (await response.json()) as { choices: [{ message: { content: string } }] }
    ).choices[0].message.content;
    const thinkStart = answer.search(/<think>/i);
    if (thinkStart === -1) return answer.trim();
    const afterThink = answer.slice(thinkStart);
    const thinkEnd = afterThink.search(/<\/think>/i);
    return (
      thinkEnd === -1
        ? answer.slice(0, thinkStart)
        : answer.slice(0, thinkStart) +
          afterThink.slice(thinkEnd + afterThink.match(/<\/think>/i)![0].length)
    ).trim();
  }
  private async plan(question: string): Promise<AnalyticsPlan | null> {
    const key =
      this.config.get<string>('GROQ_API_KEY') || process.env.GROQ_API_KEY;
    if (!key) return null;
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 160,
          messages: [
            {
              role: 'system',
              content:
                'Convert the user question into JSON only. Never write SQL. Use conversation for greetings, casual chat, or questions unrelated to restaurant data. Allowed intent values: conversation, occupancy, inventory, menu, staffSummary, payments, serviceIssues, cancellations, bookings, customers, revenue, orderDetails, overview. Use inventory for stock or ingredient availability, menu for food/menu questions, staffSummary for staff counts/statuses, payments for payment totals or methods, and orderDetails for requests to list or inspect individual orders. Allowed period values: today, yesterday, dayBeforeYesterday, 7d, 30d. Allowed groupBy values: day, type. Use groupBy only when requested. Use type only for serviceIssues. Return exactly: {"intent":"...","period":"...","groupBy":"..."}.',
            },
            { role: 'user', content: question },
          ],
        }),
      },
    );
    if (!response.ok) return null;
    try {
      const content = (
        (await response.json()) as {
          choices: [{ message: { content: string } }];
        }
      ).choices[0].message.content;
      const parsed = JSON.parse(
        content.match(/\{[\s\S]*\}/)?.[0] ?? '',
      ) as Partial<AnalyticsPlan>;
      if (
        ![
          'conversation',
          'occupancy',
          'inventory',
          'menu',
          'staffSummary',
          'payments',
          'serviceIssues',
          'cancellations',
          'bookings',
          'customers',
          'revenue',
          'orderDetails',
          'overview',
        ].includes(parsed.intent ?? '') ||
        !['today', 'yesterday', 'dayBeforeYesterday', '7d', '30d'].includes(
          parsed.period ?? '',
        )
      )
        return null;
      if (
        parsed.groupBy !== undefined &&
        !['day', 'type'].includes(parsed.groupBy)
      )
        return null;
      if (parsed.groupBy === 'type' && parsed.intent !== 'serviceIssues')
        return null;
      return {
        intent: parsed.intent as AnalyticsPlan['intent'],
        period: parsed.period as AnalyticsPlan['period'],
        ...(parsed.groupBy ? { groupBy: parsed.groupBy } : {}),
      };
    } catch {
      return null;
    }
  }
  private period(q: string) {
    if (/(last|past|this)\s+week|7\s*days|hafta|week/.test(q))
      return {
        from: "CURRENT_DATE - INTERVAL '6 days'",
        to: "CURRENT_DATE + INTERVAL '1 day'",
        label: 'last 7 days',
        value: '7d' as const,
      };
    if (/(last|past|this)\s+month|30\s*days|mahina|month/.test(q))
      return {
        from: "CURRENT_DATE - INTERVAL '29 days'",
        to: "CURRENT_DATE + INTERVAL '1 day'",
        label: 'last 30 days',
        value: '30d' as const,
      };
    if (/day before yesterday|two days ago|parsi ko hijo/.test(q))
      return {
        from: "CURRENT_DATE - INTERVAL '2 days'",
        to: "CURRENT_DATE - INTERVAL '1 day'",
        label: 'day before yesterday',
        value: 'dayBeforeYesterday' as const,
      };
    if (/yesterday|hijo/.test(q))
      return {
        from: "CURRENT_DATE - INTERVAL '1 day'",
        to: 'CURRENT_DATE',
        label: 'yesterday',
        value: 'yesterday' as const,
      };
    return {
      from: 'CURRENT_DATE',
      to: "CURRENT_DATE + INTERVAL '1 day'",
      label: 'today',
      value: 'today' as const,
    };
  }
  private intent(question: string): DataIntent | 'conversation' {
    return classifyAssistantIntent(question);
  }
  private async safeData(
    question: string,
    ids?: number[],
    aiPlan?: AnalyticsPlan | null,
  ) {
    const q = question.toLowerCase();
    const period = this.period(q);
    const fallbackIntent = this.intent(question);
    const selected = aiPlan ?? { intent: fallbackIntent, period: period.value };
    // 'conversation' can never actually reach safeData() — chat() routes it
    // to CHAT and returns before calling this — but AnalyticsPlan['intent']
    // carries that member too. Fold it into 'overview' (the other
    // unhandled-by-name intent below) so `intent` is DataIntent throughout,
    // matching the behavior this already had by falling through unnamed.
    const intent =
      selected.intent === 'conversation' ? 'overview' : selected.intent;
    const selectedPeriod =
      selected.period === period.value
        ? period
        : selected.period === '7d'
          ? {
              from: "CURRENT_DATE - INTERVAL '6 days'",
              to: "CURRENT_DATE + INTERVAL '1 day'",
              label: 'last 7 days',
            }
          : selected.period === '30d'
            ? {
                from: "CURRENT_DATE - INTERVAL '29 days'",
                to: "CURRENT_DATE + INTERVAL '1 day'",
                label: 'last 30 days',
              }
            : selected.period === 'dayBeforeYesterday'
              ? {
                  from: "CURRENT_DATE - INTERVAL '2 days'",
                  to: "CURRENT_DATE - INTERVAL '1 day'",
                  label: 'day before yesterday',
                }
              : selected.period === 'yesterday'
                ? {
                    from: "CURRENT_DATE - INTERVAL '1 day'",
                    to: 'CURRENT_DATE',
                    label: 'yesterday',
                  }
                : {
                    from: 'CURRENT_DATE',
                    to: "CURRENT_DATE + INTERVAL '1 day'",
                    label: 'today',
                  };
    const outletFilter = ids ? ' AND outlet_id = ANY($1::bigint[])' : '';
    const params = ids ? [ids] : [];
    if (intent === 'occupancy') {
      assertAssistantDataAccess(intent, ['dining_tables', 'outlets']);
      const metrics = await this.db.query(
        `SELECT dt.name, dt.code, dt.status, dt.capacity, o.name AS "outletName" FROM dining_tables dt JOIN outlets o ON o.id = dt.outlet_id WHERE dt.outlet_id = ANY($1::bigint[]) AND dt.is_active = true ORDER BY o.name, dt.sort_order, dt.name`,
        params,
      );
      return { intent, period: period.label, metrics };
    }

    const dateFilter = (column: string) =>
      ` AND ${column} >= ${selectedPeriod.from} AND ${column} < ${selectedPeriod.to}`;
    const groupBy = selected.groupBy;
    let metrics: unknown;
    if (intent === 'inventory') {
      assertAssistantDataAccess(intent, [
        'warehouse_ingredient_stocks',
        'ingredients',
        'warehouses',
      ]);
      metrics = await this.db.query(
        `SELECT i.name, i.code, SUM(s.quantity)::numeric AS quantity, SUM(s.reserved_quantity)::numeric AS "reservedQuantity", GREATEST(SUM(s.quantity) - SUM(s.reserved_quantity), 0)::numeric AS "availableQuantity", MAX(i.reorder_level)::numeric AS "reorderLevel", MAX(i.minimum_stock)::numeric AS "minimumStock", CASE WHEN SUM(s.quantity) <= 0 THEN 'out_of_stock' WHEN SUM(s.quantity) - SUM(s.reserved_quantity) <= GREATEST(MAX(i.reorder_level), MAX(i.minimum_stock)) THEN 'low_stock' ELSE 'in_stock' END AS status FROM warehouse_ingredient_stocks s JOIN ingredients i ON i.id = s.ingredient_id JOIN warehouses w ON w.id = s.warehouse_id WHERE i.is_active = true${ids ? ' AND w.outlet_id = ANY($1::bigint[])' : ''} GROUP BY i.id, i.name, i.code ORDER BY "availableQuantity" ASC LIMIT 100`,
        params,
      );
    } else if (intent === 'menu') {
      assertAssistantDataAccess(intent, ['foods']);
      metrics = await this.db.query(
        `SELECT name, item_type AS type, is_active AS "isActive" FROM foods WHERE is_active = true ORDER BY name LIMIT 200`,
      );
    } else if (intent === 'staffSummary') {
      assertAssistantDataAccess(intent, [
        'employees',
        'employee_outlet_assignments',
      ]);
      metrics = await this.db.query(
        `SELECT employment_status AS status, COUNT(*)::int AS count FROM employees WHERE is_active = true${ids ? ' AND EXISTS (SELECT 1 FROM employee_outlet_assignments eoa WHERE eoa.employee_id = employees.id AND eoa.is_active = true AND eoa.outlet_id = ANY($1::bigint[]))' : ''} GROUP BY employment_status ORDER BY employment_status`,
        params,
      );
    } else if (intent === 'payments') {
      assertAssistantDataAccess(intent, ['order_payments']);
      metrics = await this.db.query(
        `SELECT method, type, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric AS amount FROM order_payments WHERE status = 'completed'${dateFilter('created_at')}${outletFilter} GROUP BY method, type ORDER BY amount DESC`,
        params,
      );
    } else if (intent === 'orderDetails') {
      assertAssistantDataAccess(intent, ['orders', 'order_items', 'foods']);
      metrics = /^orders?$/.test(q.trim())
        ? (
            await this.db.query(
              `SELECT COUNT(*)::int AS orders FROM orders WHERE status <> 'cancelled'${dateFilter('created_at')}${outletFilter}`,
              params,
            )
          )[0]
        : await this.db.query(
            `SELECT o.order_number AS "orderNumber", o.bill_number AS "billNumber", o.order_type AS "orderType", o.order_source AS "orderSource", o.status, o.payment_status AS "paymentStatus", o.grand_total AS "grandTotal", o.created_at AS "createdAt", COALESCE(items.items, '[]'::json) AS items FROM orders o LEFT JOIN LATERAL (SELECT json_agg(json_build_object('name', f.name, 'quantity', oi.quantity) ORDER BY f.name) AS items FROM order_items oi JOIN foods f ON f.id = oi.food_id WHERE oi.order_id = o.id) items ON true WHERE o.status <> 'cancelled'${dateFilter('o.created_at')}${ids ? ' AND o.outlet_id = ANY($1::bigint[])' : ''} ORDER BY o.created_at LIMIT 100`,
            params,
          );
    } else if (intent === 'serviceIssues') {
      assertAssistantDataAccess(intent, ['service_requests']);
      metrics = await this.db.query(
        `SELECT ${groupBy === 'day' ? "DATE_TRUNC('day', created_at)::date" : 'type AS category'}, COUNT(*)::int AS count FROM service_requests WHERE 1=1${dateFilter('created_at')}${outletFilter} GROUP BY ${groupBy === 'day' ? "DATE_TRUNC('day', created_at)" : 'type'} ORDER BY count DESC LIMIT 100`,
        params,
      );
    } else if (intent === 'cancellations') {
      assertAssistantDataAccess(intent, ['reservations']);
      metrics =
        groupBy === 'day'
          ? await this.db.query(
              `SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS cancellations FROM reservations WHERE status='cancelled'${dateFilter('created_at')}${outletFilter} GROUP BY DATE_TRUNC('day', created_at) ORDER BY day`,
              params,
            )
          : (
              await this.db.query(
                `SELECT COUNT(*)::int AS cancellations FROM reservations WHERE status='cancelled'${dateFilter('created_at')}${outletFilter}`,
                params,
              )
            )[0];
    } else if (intent === 'bookings') {
      assertAssistantDataAccess(intent, ['reservations']);
      metrics =
        groupBy === 'day'
          ? await this.db.query(
              `SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS bookings FROM reservations WHERE status <> 'cancelled'${dateFilter('created_at')}${outletFilter} GROUP BY DATE_TRUNC('day', created_at) ORDER BY day`,
              params,
            )
          : (
              await this.db.query(
                `SELECT COUNT(*)::int AS bookings FROM reservations WHERE status <> 'cancelled'${dateFilter('created_at')}${outletFilter}`,
                params,
              )
            )[0];
    } else if (intent === 'customers') {
      assertAssistantDataAccess(intent, ['orders']);
      metrics = (
        await this.db.query(
          `SELECT COUNT(DISTINCT customer_id)::int AS customers FROM orders WHERE status <> 'cancelled' AND customer_id IS NOT NULL${dateFilter('created_at')}${outletFilter}`,
          params,
        )
      )[0];
    } else if (intent === 'revenue') {
      assertAssistantDataAccess(intent, ['orders']);
      metrics =
        groupBy === 'day'
          ? await this.db.query(
              `SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS orders, COALESCE(SUM(grand_total) FILTER (WHERE payment_status = 'paid'),0)::numeric AS revenue FROM orders WHERE status <> 'cancelled'${dateFilter('created_at')}${outletFilter} GROUP BY DATE_TRUNC('day', created_at) ORDER BY day`,
              params,
            )
          : (
              await this.db.query(
                `SELECT COUNT(*)::int AS orders, COALESCE(SUM(grand_total) FILTER (WHERE payment_status = 'paid'),0)::numeric AS revenue FROM orders WHERE status <> 'cancelled'${dateFilter('created_at')}${outletFilter}`,
                params,
              )
            )[0];
    } else {
      assertAssistantDataAccess(intent, ['orders']);
      metrics = (
        await this.db.query(
          `SELECT COUNT(*)::int AS orders, COALESCE(SUM(grand_total) FILTER (WHERE payment_status = 'paid'),0)::numeric AS revenue FROM orders WHERE status <> 'cancelled'${dateFilter('created_at')}${outletFilter}`,
          params,
        )
      )[0];
    }
    return {
      intent,
      period: selectedPeriod.label,
      ...(groupBy ? { groupBy } : {}),
      metrics,
    };
  }
  async chat(user: User, question: string, outletId?: number) {
    await this.assertAssistantAccess(user);
    this.requireTenant();
    if (!question.trim()) throw new BadRequestException('Question is required');

    // Authorize the requested data domain before resolving outlets or querying
    // any restaurant data. The LLM planner receives only the question, never
    // database data, and cannot grant access by changing its predicted intent.
    const fallbackIntent = this.intent(question);
    const plan = await this.plan(question);
    // Keep general conversation tenant-aware. It receives restaurant identity
    // context, but never receives business rows unless the request maps to a
    // permitted data intent.
    const selectedIntent =
      fallbackIntent !== 'conversation' && fallbackIntent !== 'overview'
        ? fallbackIntent
        : plan?.intent && plan.intent !== 'conversation'
          ? plan.intent
          : 'conversation';
    const safeIntent: DataIntent =
      selectedIntent === 'conversation' ? 'overview' : selectedIntent;
    const effectivePlan = plan?.intent === selectedIntent ? plan : null;
    await this.assertIntentAccess(user, selectedIntent);

    const route: Route =
      selectedIntent !== 'conversation' &&
      /(why|improv|recommend|insight|trend|going wrong|sudhar)/i.test(question)
        ? 'INSIGHT'
        : selectedIntent === 'conversation'
          ? 'CHAT'
          : 'DATA';

    const restaurant = await this.restaurantContext();
    if (route === 'CHAT') {
      const data = {
        responseMode: 'greeting',
        intent: 'restaurant_general_conversation',
        restaurantName: restaurant.name,
      };
      return { route, answer: await this.llm(question, data) };
    }

    const allTablesRequested =
      /\ball\s+(the\s+)?tables?\b|\bevery\s+table\b|\ball\s+outlets?\b/i.test(
        question,
      );
    const ids = await this.ids(user, allTablesRequested ? undefined : outletId);
    const data =
      route === 'INSIGHT'
        ? {
            intent: 'dailySummary',
            period: 'last 7 days',
            summaries: await this.db.query(
              `SELECT summary_date, metrics FROM daily_summaries WHERE outlet_id = ANY($1::bigint[]) ORDER BY summary_date DESC LIMIT 7`,
              [ids],
            ),
          }
        : await this.safeData(question, ids, effectivePlan);

    if (safeIntent !== 'overview' && data.intent === 'overview') {
      const fix = { ...data, intent: safeIntent };
      return {
        route,
        answer: await this.llm(question, {
          responseMode: 'restaurant_data',
          restaurantName: restaurant.name,
          ...fix,
        }),
        ...(route === 'DATA' ? { data: fix } : {}),
      };
    }

    if (data.intent === 'orderDetails' && 'metrics' in data) {
      return {
        route,
        answer: formatOrderAnswer(question, data.metrics, data.period),
        ...(route === 'DATA' ? { data } : {}),
      };
    }

    const llmContext = {
      responseMode: 'restaurant_data',
      restaurantName: restaurant.name,
      ...data,
    };
    return {
      route,
      answer: await this.llm(question, llmContext),
      ...(route === 'DATA' ? { data } : {}),
    };
  }
  async dailySummary(secret?: string) {
    const expected = process.env.ASSISTANT_CRON_SECRET;
    if (!expected || secret !== expected)
      throw new UnauthorizedException('Invalid cron secret');
    const currentTenantId = this.tenantContext.getTenantId();
    const tenantIds =
      currentTenantId === null
        ? (
            (await this.db.query(
              'SELECT id FROM tenants WHERE is_active = true ORDER BY id',
            )) as Array<{ id: string | number }>
          ).map((row) => Number(row.id))
        : [currentTenantId];
    const results: Array<{ tenantId: number; outletId: number }> = [];
    for (const tenantId of tenantIds) {
      await this.tenantContext.run(tenantId, async () => {
        const outlets = (
          (await this.db.query('SELECT id FROM outlets WHERE tenant_id = $1', [
            tenantId,
          ])) as Array<{ id: string | number }>
        ).map((row) => Number(row.id));
        for (const outletId of outlets) {
          const [metrics] = (await this.db.query(
            `SELECT COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS bookings, COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancellations, COALESCE(SUM(grand_total) FILTER (WHERE status <> 'cancelled' AND payment_status = 'paid'),0)::numeric AS revenue FROM orders WHERE outlet_id=$1 AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + interval '1 day'`,
            [outletId],
          )) as Array<Record<string, unknown>>;
          const narrative = await this.llm(
            "Summarize today's restaurant performance and give concise actions.",
            metrics,
          );
          await this.db.query(
            `INSERT INTO daily_summaries(tenant_id,outlet_id,summary_date,metrics,narrative) VALUES($1,$2,CURRENT_DATE,$3,$4) ON CONFLICT(outlet_id,summary_date) DO UPDATE SET metrics=EXCLUDED.metrics,narrative=EXCLUDED.narrative,updated_at=now()`,
            [
              tenantId,
              outletId,
              JSON.stringify({
                ...metrics,
                occupancyRate: null,
                occupancyNote:
                  'Room inventory is not available in the current schema.',
              }),
              narrative,
            ],
          );
          results.push({ tenantId, outletId });
        }
      });
    }
    return { processed: results.length, results };
  }
}
