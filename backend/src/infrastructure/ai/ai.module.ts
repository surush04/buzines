import { Module, forwardRef } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';
import { AiController } from './ai.controller';
import { AiSchedulerService } from './ai-scheduler.service';
import { BusinessContextService } from './business-context.service';
import { LlmService } from './llm.service';
import { AuthModule } from '../../modules/auth/auth.module';
import { DirectiveModule } from '../../modules/directives/directive.module';

@Module({
  imports: [AuthModule, forwardRef(() => DirectiveModule)],
  controllers: [AiController],
  providers: [AiEngineService, AiSchedulerService, BusinessContextService, LlmService],
  exports: [AiEngineService, BusinessContextService, LlmService],
})
export class AiModule {}
