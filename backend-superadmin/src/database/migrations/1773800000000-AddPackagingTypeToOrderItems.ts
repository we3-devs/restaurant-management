import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Per-item packaging: lets a single order mix dine-in ("plating") and
 * takeaway items instead of forcing one packaging choice for the whole
 * order — e.g. a table where half the party eats in and half takes food out.
 */
export class AddPackagingTypeToOrderItems1773800000000
  implements MigrationInterface
{
  name = 'AddPackagingTypeToOrderItems1773800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'order_items',
      new TableColumn({
        name: 'packaging_type',
        type: 'varchar',
        length: '20',
        default: `'plating'`,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('order_items', 'packaging_type');
  }
}
