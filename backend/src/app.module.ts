import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './infrastructure/ai/ai.module';
import { NotificationModule } from './infrastructure/notifications/notification.module';
import { WebSocketModule } from './infrastructure/websocket/websocket.module';
import { DirectiveModule } from './modules/directives/directive.module';
import { TelegramModule } from './infrastructure/telegram/telegram.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    CompanyModule,
    DashboardModule,
    AiModule,
    NotificationModule,
    WebSocketModule,
    DirectiveModule,
    TelegramModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
