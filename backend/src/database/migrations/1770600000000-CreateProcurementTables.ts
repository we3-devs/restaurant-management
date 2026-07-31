import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcurementTables1770600000000 implements MigrationInterface {
  name = 'CreateProcurementTables1770600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Purchase Orders
    await queryRunner.query(`
      CREATE TABLE purchase_orders (
        id BIGSERIAL PRIMARY KEY,
        po_no VARCHAR(255) UNIQUE NOT NULL,
        supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
        expected_delivery_date DATE,
        currency VARCHAR(10) DEFAULT 'NPR',
        notes TEXT,
        status VARCHAR(30) DEFAULT 'draft' CHECK (status IN (
          'draft','pending_approval','approved','partially_received','received','completed','cancelled'
        )),
        subtotal DECIMAL(18,2) DEFAULT 0,
        discount_amount DECIMAL(18,2) DEFAULT 0,
        tax_amount DECIMAL(18,2) DEFAULT 0,
        grand_total DECIMAL(18,2) DEFAULT 0,
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_order_items (
        id BIGSERIAL PRIMARY KEY,
        purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
        quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
        unit VARCHAR(50),
        unit_cost DECIMAL(18,6) DEFAULT 0,
        discount DECIMAL(18,2) DEFAULT 0,
        tax DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        received_quantity DECIMAL(18,4) DEFAULT 0,
        remaining_quantity DECIMAL(18,4) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Goods Receiving (GRN)
    await queryRunner.query(`
      CREATE TABLE goods_receivings (
        id BIGSERIAL PRIMARY KEY,
        grn_no VARCHAR(255) UNIQUE NOT NULL,
        purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
        supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
        received_date DATE NOT NULL,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','received','cancelled')),
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE goods_receiving_items (
        id BIGSERIAL PRIMARY KEY,
        goods_receiving_id BIGINT NOT NULL REFERENCES goods_receivings(id) ON DELETE CASCADE,
        purchase_order_item_id BIGINT NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
        ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
        quantity_received DECIMAL(18,4) NOT NULL DEFAULT 0,
        unit_cost DECIMAL(18,6) DEFAULT 0,
        total_cost DECIMAL(18,2) DEFAULT 0,
        batch_no VARCHAR(255),
        expiry_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Purchase Returns
    await queryRunner.query(`
      CREATE TABLE purchase_returns (
        id BIGSERIAL PRIMARY KEY,
        return_no VARCHAR(255) UNIQUE NOT NULL,
        purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
        goods_receiving_id BIGINT REFERENCES goods_receivings(id) ON DELETE SET NULL,
        supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
        return_date DATE NOT NULL,
        reason TEXT,
        refund_type VARCHAR(20) DEFAULT 'refund' CHECK (refund_type IN ('refund','replacement','both')),
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','processed','cancelled')),
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_return_items (
        id BIGSERIAL PRIMARY KEY,
        purchase_return_id BIGINT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        purchase_order_item_id BIGINT NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
        ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
        quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
        unit_cost DECIMAL(18,6) DEFAULT 0,
        total_cost DECIMAL(18,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Supplier Payments
    await queryRunner.query(`
      CREATE TABLE supplier_payments (
        id BIGSERIAL PRIMARY KEY,
        payment_no VARCHAR(255) UNIQUE NOT NULL,
        supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL,
        amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash','bank','digital')),
        reference_no VARCHAR(255),
        notes TEXT,
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed','pending','cancelled')),
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
      CREATE INDEX idx_po_outlet ON purchase_orders(outlet_id);
      CREATE INDEX idx_po_status ON purchase_orders(status);
      CREATE INDEX idx_po_warehouse ON purchase_orders(warehouse_id);
      CREATE INDEX idx_po_items_order ON purchase_order_items(purchase_order_id);
      CREATE INDEX idx_po_items_ingredient ON purchase_order_items(ingredient_id);
      CREATE INDEX idx_grn_po ON goods_receivings(purchase_order_id);
      CREATE INDEX idx_grn_supplier ON goods_receivings(supplier_id);
      CREATE INDEX idx_grn_warehouse ON goods_receivings(warehouse_id);
      CREATE INDEX idx_grn_items_grn ON goods_receiving_items(goods_receiving_id);
      CREATE INDEX idx_grn_items_po_item ON goods_receiving_items(purchase_order_item_id);
      CREATE INDEX idx_pr_po ON purchase_returns(purchase_order_id);
      CREATE INDEX idx_pr_supplier ON purchase_returns(supplier_id);
      CREATE INDEX idx_pr_status ON purchase_returns(status);
      CREATE INDEX idx_pr_items_return ON purchase_return_items(purchase_return_id);
      CREATE INDEX idx_sp_supplier ON supplier_payments(supplier_id);
      CREATE INDEX idx_sp_po ON supplier_payments(purchase_order_id);
      CREATE INDEX idx_sp_outlet ON supplier_payments(outlet_id);
      CREATE INDEX idx_sp_method ON supplier_payments(payment_method);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_payments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_return_items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_returns CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS goods_receiving_items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS goods_receivings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_order_items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_orders CASCADE`);
  }
}
