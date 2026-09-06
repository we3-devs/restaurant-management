import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Customer } from '../../customers/entities/customer.entity';
import { TableSession } from './table-session.entity';

@Entity({ name: 'table_session_customers' })
export class TableSessionCustomer {
  @PrimaryColumn({ name: 'table_session_id', type: 'bigint', transformer: new BigIntTransformer() })
  tableSessionId: number;

  @PrimaryColumn({ name: 'customer_id', type: 'bigint', transformer: new BigIntTransformer() })
  customerId: number;

  @ManyToOne(() => TableSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_session_id' })
  tableSession: TableSession;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
