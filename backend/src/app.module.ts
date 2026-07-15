import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './common/auth/auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ConnectorsModule,
    MetricsModule,
    ConnectionsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Auth runs on every route unless marked @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
