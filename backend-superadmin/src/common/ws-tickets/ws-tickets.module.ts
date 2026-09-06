import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WsTicket } from './ws-ticket.entity';
import { WsTicketsService } from './ws-tickets.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WsTicket])],
  providers: [WsTicketsService],
  exports: [WsTicketsService],
})
export class WsTicketsModule {}
