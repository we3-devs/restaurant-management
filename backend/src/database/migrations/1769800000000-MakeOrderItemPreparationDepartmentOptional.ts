import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class MakeOrderItemPreparationDepartmentOptional1769800000000 implements MigrationInterface {
  name = 'MakeOrderItemPreparationDepartmentOptional1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'order_items',
      'preparation_department_id',
      new TableColumn({
        name: 'preparation_department_id',
        type: 'bigint',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'order_items',
      'preparation_department_id',
      new TableColumn({
        name: 'preparation_department_id',
        type: 'bigint',
        isNullable: false,
      }),
    );
  }
}
