import { ForbiddenException, Injectable, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutletAccessService, ALL_OUTLETS, AccessibleOutlets } from '../auth/outlet-access.service';
import { PermissionsService } from '../auth/permissions.service';
import { User } from '../users/entities/user.entity';
import { DataSource } from 'typeorm';
import { ASSISTANT_SYSTEM_PROMPT, ADMIN_ROLES } from './assistant.constants';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

type Route = 'DOCUMENT' | 'DATA' | 'INSIGHT';
const number = (value: unknown) => Number(value ?? 0);

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  constructor(private readonly db: DataSource, private readonly access: OutletAccessService, private readonly permissions: PermissionsService, private readonly config: ConfigService) {}

  private async assertAdmin(user: User) {
    if (user.isSuperadmin) return;
    const roles = await this.permissions.getRoleSlugs(user.id);
    if (![...roles].some((role) => ADMIN_ROLES.has(role))) throw new ForbiddenException('Only admins can use the operations assistant');
  }
  private async scope(user: User, outletId?: number): Promise<AccessibleOutlets | number> {
    const outlets = await this.access.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (outletId !== undefined) await this.access.assertOutletAccess(user.id, user.isSuperadmin, outletId);
    if (outlets !== ALL_OUTLETS && outlets.length === 0) throw new ForbiddenException('You do not have access to any outlet');
    return outletId ?? outlets;
  }
  private ids(scope: AccessibleOutlets | number) { return scope === ALL_OUTLETS ? undefined : Array.isArray(scope) ? scope : [scope]; }
  private async embed(text: string): Promise<number[]> {
    const key = this.config.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not configured');
    const response = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'text-embedding-3-small', input: text }) });
    if (!response.ok) throw new Error(`Embedding request failed (${response.status})`);
    return ((await response.json()) as { data: [{ embedding: number[] }] }).data[0].embedding;
  }
  private async llm(question: string, context: unknown): Promise<string> {
    const key = this.config.get<string>('GROQ_API_KEY') || process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not configured');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: 0.1, messages: [{ role: 'system', content: ASSISTANT_SYSTEM_PROMPT }, { role: 'user', content: `Question: ${question}\nTrusted context:\n${JSON.stringify(context)}` }] }) });
    if (!response.ok) throw new Error(`LLM request failed (${response.status})`);
    return ((await response.json()) as { choices: [{ message: { content: string } }] }).choices[0].message.content;
  }
  private route(question: string): Route {
    const q = question.toLowerCase();
    if (/(policy|sop|procedure|amenit|check.?in|check.?out|прав|niyam|kasari)/.test(q)) return 'DOCUMENT';
    if (/(why|improv|recommend|insight|trend|going wrong|किन|sudhar)/.test(q)) return 'INSIGHT';
    if (/(how many|kati|booking|reservation|revenue|sales|occupancy|cancel|complaint|aaja|today|month|week)/.test(q)) return 'DATA';
    return 'DOCUMENT';
  }
  async ingest(user: User, file: Express.Multer.File, outletId?: number) {
    await this.assertAdmin(user); const scope = await this.scope(user, outletId); const ids = this.ids(scope);
    if (ids === undefined) throw new BadRequestException('Superadmin must select an outlet when ingesting a document');
    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)) throw new BadRequestException('Only PDF and DOCX files are supported');
    let text: string;
    if (file.mimetype === 'application/pdf') {
      const parser = new PDFParse({ data: file.buffer });
      try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
    } else {
      text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    }
    const clean = text.replace(/\s+/g, ' ').trim(); if (!clean) throw new BadRequestException('The document contains no readable text');
    const chunks = clean.match(/.{1,4200}(?:\s|$)/g)?.map((chunk) => chunk.trim()).filter(Boolean) ?? [];
    const document = (await this.db.query('INSERT INTO assistant_documents(outlet_id,title,mime_type,created_by) VALUES($1,$2,$3,$4) RETURNING id', [ids[0], file.originalname, file.mimetype, user.id]))[0];
    for (let index = 0; index < chunks.length; index++) { const embedding = await this.embed(chunks[index]); await this.db.query('INSERT INTO document_chunks(document_id,outlet_id,content,embedding,metadata) VALUES($1,$2,$3,$4::vector,$5)', [document.id, ids[0], chunks[index], `[${embedding.join(',')}]`, JSON.stringify({ source: file.originalname, chunk: index })]); }
    return { id: Number(document.id), title: file.originalname, chunks: chunks.length };
  }
  async chat(user: User, question: string, outletId?: number) {
    await this.assertAdmin(user); if (!question.trim()) throw new BadRequestException('Question is required'); const scope = await this.scope(user, outletId); const route = this.route(question); const ids = this.ids(scope);
    if (route === 'DOCUMENT') { const embedding = await this.embed(question); const rows = await this.db.query(`SELECT content, metadata, 1 - (embedding <=> $1::vector) AS similarity FROM document_chunks WHERE ($2::bigint[] IS NULL OR outlet_id = ANY($2)) ORDER BY embedding <=> $1::vector LIMIT 6`, [`[${embedding.join(',')}]`, ids ?? null]); return { route, answer: await this.llm(question, rows) }; }
    if (route === 'INSIGHT') { const rows = await this.summaryRows(ids); return { route, answer: await this.llm(question, rows) }; }
    const data = await this.safeData(question, ids); return { route, answer: await this.llm(question, data), data };
  }
  private async safeData(question: string, ids?: number[]) { const q = question.toLowerCase(); const filter = ids ? ' AND o.outlet_id = ANY($1::bigint[])' : ''; const params = ids ? [ids] : []; if (/cancel/.test(q)) return this.db.query(`SELECT COUNT(*)::int AS cancellations FROM reservations r WHERE r.status='cancelled' ${ids ? 'AND r.outlet_id = ANY($1::bigint[])' : ''}`, params).then((r) => r[0]); if (/booking|reservation/.test(q)) return this.db.query(`SELECT COUNT(*)::int AS bookings FROM reservations r WHERE r.status <> 'cancelled' AND r.created_at >= CURRENT_DATE ${ids ? 'AND r.outlet_id = ANY($1::bigint[])' : ''}`, params).then((r) => r[0]); return this.db.query(`SELECT COUNT(*)::int AS orders, COALESCE(SUM(o.grand_total),0)::numeric AS revenue FROM orders o WHERE o.status <> 'cancelled' AND o.created_at >= CURRENT_DATE${filter}`, params).then((r) => r[0]); }
  private async summaryRows(ids?: number[]) { return this.db.query(`SELECT summary_date, metrics, narrative FROM daily_summaries WHERE ($1::bigint[] IS NULL OR outlet_id = ANY($1)) ORDER BY summary_date DESC LIMIT 14`, [ids ?? null]); }
  async dailySummary(secret?: string) { const expected = process.env.ASSISTANT_CRON_SECRET; if (!expected || secret !== expected) throw new UnauthorizedException('Invalid cron secret'); const outlets = (await this.db.query('SELECT id FROM outlets WHERE is_active = true') as Array<{ id: string }>).map((row) => Number(row.id)); const results: Array<{ outletId: number }> = []; for (const outletId of outlets) { const [metrics] = await this.db.query(`SELECT COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS bookings, COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancellations, COALESCE(SUM(grand_total) FILTER (WHERE status <> 'cancelled'),0)::numeric AS revenue FROM orders WHERE outlet_id=$1 AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + interval '1 day'`, [outletId]) as Array<Record<string, unknown>>; const narrative = await this.llm('Summarize today\'s hotel performance and give concise actions.', metrics); await this.db.query(`INSERT INTO daily_summaries(outlet_id,summary_date,metrics,narrative) VALUES($1,CURRENT_DATE,$2,$3) ON CONFLICT(outlet_id,summary_date) DO UPDATE SET metrics=EXCLUDED.metrics,narrative=EXCLUDED.narrative,updated_at=now()`, [outletId, JSON.stringify({ ...metrics, occupancyRate: null, occupancyNote: 'Room inventory is not available in the current restaurant schema.' }), narrative]); results.push({ outletId }); } return { processed: results.length, results }; }
}
