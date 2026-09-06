import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssistantTables1775900000000 implements MigrationInterface {
  name = 'CreateAssistantTables1775900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assistant_documents (
        id bigserial PRIMARY KEY, outlet_id bigint NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        title varchar(255) NOT NULL, mime_type varchar(120) NOT NULL,
        created_by bigint REFERENCES users(id) ON DELETE SET NULL, created_at timestamp NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id bigserial PRIMARY KEY, document_id bigint NOT NULL REFERENCES assistant_documents(id) ON DELETE CASCADE,
        outlet_id bigint NOT NULL REFERENCES outlets(id) ON DELETE CASCADE, content text NOT NULL,
        embedding vector(1536) NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS document_chunks_outlet_id_idx ON document_chunks(outlet_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id bigserial PRIMARY KEY, outlet_id bigint NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        summary_date date NOT NULL, metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
        narrative text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
        UNIQUE(outlet_id, summary_date)
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS daily_summaries_outlet_date_idx ON daily_summaries(outlet_id, summary_date DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS daily_summaries');
    await queryRunner.query('DROP TABLE IF EXISTS document_chunks');
    await queryRunner.query('DROP TABLE IF EXISTS assistant_documents');
  }
}
