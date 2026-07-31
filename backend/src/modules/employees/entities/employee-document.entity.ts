import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Employee } from './employee.entity';

@Entity({ name: 'employee_documents' })
export class EmployeeDocument {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: new BigIntTransformer() })
  id: number;
  @Column({ name: 'employee_id', type: 'bigint', transformer: new BigIntTransformer() })
  employeeId: number;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
  @Column({ name: 'document_type', type: 'varchar', length: 100 })
  documentType: string;
  @Column({ name: 'file_name', type: 'varchar', length: 500 })
  fileName: string;
  @Column({ name: 'file_path', type: 'varchar', length: 1000 })
  filePath: string;
  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize: number | null;
  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;
  @Column({ type: 'text', nullable: true })
  notes: string | null;
  @Column({ name: 'uploaded_by', type: 'bigint', transformer: new BigIntTransformer(), nullable: true })
  uploadedBy: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
