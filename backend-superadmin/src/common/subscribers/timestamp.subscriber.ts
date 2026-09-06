import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  ObjectLiteral,
  UpdateEvent,
} from 'typeorm';

/**
 * TypeORM 0.3.x no longer sets @CreateDateColumn/@UpdateDateColumn values
 * client-side on insert — it expects the DB column itself to carry a
 * DEFAULT/trigger. The existing Laravel-owned schema has neither (Eloquent
 * manages timestamps in PHP), so without this subscriber every insert
 * mapped onto that schema silently leaves created_at/updated_at NULL.
 */
@EventSubscriber()
export class TimestampSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<ObjectLiteral>): void {
    this.stamp(event.entity, event.metadata.columns, true);
  }

  beforeUpdate(event: UpdateEvent<ObjectLiteral>): void {
    if (!event.entity) {
      // Partial updates via Repository.update() have no loaded entity to
      // stamp — acceptable, those calls don't touch timestamp columns.
      return;
    }
    this.stamp(event.entity, event.metadata.columns, false);
  }

  private stamp(
    entity: ObjectLiteral,
    columns: ColumnMetadata[],
    isInsert: boolean,
  ): void {
    const now = new Date();
    for (const column of columns) {
      if ((column.isCreateDate && isInsert) || column.isUpdateDate) {
        column.setEntityValue(entity, now);
      }
    }
  }
}
