import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutletsModule } from '../outlets/outlets.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerOutlet } from './entities/customer-outlet.entity';
import { Customer } from './entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerOutlet]),
    OutletsModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [TypeOrmModule, CustomersService],
})
export class CustomersModule {}
