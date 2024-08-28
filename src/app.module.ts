import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { OrdersModule } from './orders/orders.module';
import { NatsModule } from './transports/nats.module';

@Module({
  imports: [OrdersModule, NatsModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
