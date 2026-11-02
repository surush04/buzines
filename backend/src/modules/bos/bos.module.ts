import { Module } from '@nestjs/common';
import { NotificationModule } from '../../infrastructure/notifications/notification.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyAccessService } from './access.service';
import { OpsService } from './ops.service';
import { VerificationService } from './verification.service';
import { WorkflowService } from './workflow.service';
import { MemoryService } from './memory.service';
import { ResourceService } from './resource.service';
import { SimulatorService } from './simulator.service';
import { IntegrationHubService } from './integration-hub.service';
import {
  IntegrationHubController,
  MemoryController,
  OpsController,
  ResourceController,
  SimulatorController,
  VerificationController,
  WorkflowController,
} from './bos.controllers';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [
    OpsController,
    VerificationController,
    WorkflowController,
    MemoryController,
    ResourceController,
    SimulatorController,
    IntegrationHubController,
  ],
  providers: [
    CompanyAccessService,
    OpsService,
    WorkflowService,
    VerificationService,
    MemoryService,
    ResourceService,
    SimulatorService,
    IntegrationHubService,
  ],
  exports: [CompanyAccessService, OpsService, VerificationService, WorkflowService, MemoryService],
})
export class BosModule {}
