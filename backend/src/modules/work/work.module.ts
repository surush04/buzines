import { Module } from '@nestjs/common';
import { WorkController } from './work.controller';
import { WorkService } from './work.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { BosModule } from '../bos/bos.module';

@Module({
  imports: [AuthModule, AiModule, BosModule],
  controllers: [WorkController],
  providers: [WorkService],
})
export class WorkModule {}
