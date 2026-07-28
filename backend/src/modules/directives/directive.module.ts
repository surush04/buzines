import { Module, forwardRef } from '@nestjs/common';
import { DirectiveService } from './directive.service';
import { DirectiveController } from './directive.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../../infrastructure/notifications/notification.module';
import { AiModule } from '../../infrastructure/ai/ai.module';

@Module({
  imports: [AuthModule, NotificationModule, forwardRef(() => AiModule)],
  controllers: [DirectiveController],
  providers: [DirectiveService],
  exports: [DirectiveService],
})
export class DirectiveModule {}
