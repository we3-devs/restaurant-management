import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStaffManagementTables1770700000000 implements MigrationInterface {
  name = 'CreateStaffManagementTables1770700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Positions
    await queryRunner.query(`
      CREATE TABLE positions (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Employees
    await queryRunner.query(`
      CREATE TABLE employees (
        id BIGSERIAL PRIMARY KEY,
        employee_code VARCHAR(255) UNIQUE NOT NULL,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        position_id BIGINT REFERENCES positions(id) ON DELETE SET NULL,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        department_id BIGINT REFERENCES outlet_departments(id) ON DELETE SET NULL,
        photo_url VARCHAR(1000),
        joining_date DATE,
        employment_status VARCHAR(30) DEFAULT 'active' CHECK (employment_status IN ('active','inactive','terminated','resigned')),
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(100),
        emergency_contact_relation VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Employee documents (future-ready)
    await queryRunner.query(`
      CREATE TABLE employee_documents (
        id BIGSERIAL PRIMARY KEY,
        employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
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

    // Shifts
    await queryRunner.query(`
      CREATE TABLE shifts (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        break_duration_minutes INTEGER DEFAULT 0,
        working_hours DECIMAL(5,2) DEFAULT 0,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Shift assignments
    await queryRunner.query(`
      CREATE TABLE shift_assignments (
        id BIGSERIAL PRIMARY KEY,
        shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        assigned_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(shift_id, employee_id, assigned_date)
      )
    `);

    // Attendance
    await queryRunner.query(`
      CREATE TABLE attendance (
        id BIGSERIAL PRIMARY KEY,
        employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        clock_in TIMESTAMP NOT NULL,
        clock_out TIMESTAMP,
        shift_id BIGINT REFERENCES shifts(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'present' CHECK (status IN ('present','late','early_leave','absent','half_day')),
        is_late BOOLEAN DEFAULT FALSE,
        is_early_leave BOOLEAN DEFAULT FALSE,
        late_minutes INTEGER DEFAULT 0,
        early_leave_minutes INTEGER DEFAULT 0,
        working_hours DECIMAL(5,2) DEFAULT 0,
        notes TEXT,
        adjusted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        adjustment_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Table Assignments (waiters to tables)
    await queryRunner.query(`
      CREATE TABLE table_assignments (
        id BIGSERIAL PRIMARY KEY,
        employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        dining_table_id BIGINT NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
        session_id BIGINT REFERENCES table_sessions(id) ON DELETE CASCADE,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT NOW(),
        unassigned_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Order Assignments (waiters to orders)
    await queryRunner.query(`
      CREATE TABLE order_assignments (
        id BIGSERIAL PRIMARY KEY,
        employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        outlet_id BIGINT NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        served_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX idx_employees_outlet ON employees(outlet_id);
      CREATE INDEX idx_employees_position ON employees(position_id);
      CREATE INDEX idx_employees_user ON employees(user_id);
      CREATE INDEX idx_employees_status ON employees(employment_status);
      CREATE INDEX idx_shift_assignments_employee ON shift_assignments(employee_id);
      CREATE INDEX idx_shift_assignments_date ON shift_assignments(assigned_date);
      CREATE INDEX idx_attendance_employee ON attendance(employee_id);
      CREATE INDEX idx_attendance_outlet ON attendance(outlet_id);
      CREATE INDEX idx_attendance_date ON attendance(clock_in);
      CREATE INDEX idx_attendance_status ON attendance(status);
      CREATE INDEX idx_table_assignments_employee ON table_assignments(employee_id);
      CREATE INDEX idx_table_assignments_table ON table_assignments(dining_table_id);
      CREATE INDEX idx_table_assignments_active ON table_assignments(is_active);
      CREATE INDEX idx_order_assignments_employee ON order_assignments(employee_id);
      CREATE INDEX idx_order_assignments_order ON order_assignments(order_id);
      CREATE INDEX idx_order_assignments_active ON order_assignments(is_active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_assignments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS table_assignments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS attendance CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS shift_assignments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS shifts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS employee_documents CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS positions CASCADE`);
  }
}
