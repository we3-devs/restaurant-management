import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowStandaloneReceivingAndReturns1776900000000 implements MigrationInterface {
  name = 'AllowStandaloneReceivingAndReturns1776900000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE goods_receivings ALTER COLUMN purchase_order_id DROP NOT NULL');
    await queryRunner.query('ALTER TABLE goods_receiving_items ALTER COLUMN purchase_order_item_id DROP NOT NULL');
    await queryRunner.query('ALTER TABLE purchase_returns ALTER COLUMN purchase_order_id DROP NOT NULL');
    await queryRunner.query('ALTER TABLE purchase_return_items ALTER COLUMN purchase_order_item_id DROP NOT NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE goods_receivings ALTER COLUMN purchase_order_id SET NOT NULL');
    await queryRunner.query('ALTER TABLE goods_receiving_items ALTER COLUMN purchase_order_item_id SET NOT NULL');
    await queryRunner.query('ALTER TABLE purchase_returns ALTER COLUMN purchase_order_id SET NOT NULL');
    await queryRunner.query('ALTER TABLE purchase_return_items ALTER COLUMN purchase_order_item_id SET NOT NULL');
  }
}
