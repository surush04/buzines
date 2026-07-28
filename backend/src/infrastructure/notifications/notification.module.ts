import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TelegramCoreModule } from '../telegram/telegram-core.module';

@Module({
  imports: [TelegramCoreModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
