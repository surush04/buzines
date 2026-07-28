import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { TelegramCoreModule } from './telegram-core.module';
import { TelegramController } from './telegram.controller';
import { TelegramUserService } from './telegram-user.service';
import { AiModule } from '../ai/ai.module';
import { DirectiveModule } from '../../modules/directives/directive.module';
import { AiEngineService } from '../ai/ai-engine.service';
import { DirectiveService } from '../../modules/directives/directive.service';

@Module({
  imports: [TelegramCoreModule, forwardRef(() => AiModule), forwardRef(() => DirectiveModule)],
  controllers: [TelegramController],
})
export class TelegramModule implements OnModuleInit {
  constructor(
    private telegramUser: TelegramUserService,
    private aiEngine: AiEngineService,
    private directiveService: DirectiveService,
  ) {}

  onModuleInit() {
    this.telegramUser.setHandlers(this.aiEngine, this.directiveService);
  }
}
