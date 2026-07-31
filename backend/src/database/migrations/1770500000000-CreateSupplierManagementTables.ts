import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupplierManagementTables1770500000000 implements MigrationInterface {
  name = 'CreateSupplierManagementTables1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Supplier categories
    await queryRunner.query(`
      CREATE TABLE supplier_categories (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Suppliers
    await queryRunner.query(`
      CREATE TABLE suppliers (
        id BIGSERIAL PRIMARY KEY,
        supplier_no VARCHAR(255) UNIQUE NOT NULL,
        company_name VARCHAR(500) NOT NULL,
        contact_person VARCHAR(255),
        phone VARCHAR(100),
        alt_phone VARCHAR(100),
        email VARCHAR(255),
        address TEXT,
        city VARCHAR(255),
        state VARCHAR(255),
        postal_code VARCHAR(50),
        country VARCHAR(255) DEFAULT 'Nepal',
        pan_vat VARCHAR(100),
        registration_no VARCHAR(255),
        website VARCHAR(500),
        notes TEXT,
        category_id BIGINT REFERENCES supplier_categories(id) ON DELETE SET NULL,
        outlet_id BIGINT REFERENCES outlets(id) ON DELETE CASCADE,
        default_payment_terms VARCHAR(100),
        credit_limit DECIMAL(18,2) DEFAULT 0,
        outstanding_balance DECIMAL(18,2) DEFAULT 0,
        total_purchased DECIMAL(18,2) DEFAULT 0,
        last_purchase_date DATE,
        rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
        is_active BOOLEAN DEFAULT TRUE,
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Supplier documents (future-ready)
    await queryRunner.query(`
      CREATE TABLE supplier_documents (
        id BIGSERIAL PRIMARY KEY,
        supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        document_type VARCHAR(100) NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        notes TEXT,
        uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Supplier payment terms enum via comment
    await queryRunner.query(`
      CREATE INDEX idx_suppliers_outlet ON suppliers(outlet_id);
      CREATE INDEX idx_suppliers_category ON suppliers(category_id);
      CREATE INDEX idx_suppliers_status ON suppliers(status);
      CREATE INDEX idx_suppliers_outlet_status ON suppliers(outlet_id, status);
      CREATE INDEX idx_supplier_documents_supplier ON supplier_documents(supplier_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_documents CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS suppliers CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_categories CASCADE`);
  }
}

