import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Fire/Hold support: a held order item stays in the POS cart (status remains
 * 'stock_reserved') when the rest of the order is sent to the kitchen, and is
 * only routed to the kitchen later via "Fire Held Items".
 */
export class AddHeldFlagToOrderItems1770100000000 implements MigrationInterface {
  name = 'AddHeldFlagToOrderItems1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'order_items',
      new TableColumn({
        name: 'is_held',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('order_items', 'is_held');
  }
}
