import { Module } from '@nestjs/common';
import { CeoController } from './ceo.controller';
import { CeoService } from './ceo.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { DirectiveModule } from '../directives/directive.module';
import { BosModule } from '../bos/bos.module';

@Module({
  imports: [AuthModule, AiModule, DirectiveModule, BosModule],
  controllers: [CeoController],
  providers: [CeoService],
})
export class CeoModule {}
