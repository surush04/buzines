import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { MemoryKind, MemoryProvenance, UserRole, VerificationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { CompanyAccessService, DIRECTOR_ROLES } from './access.service';
import { OpsService } from './ops.service';
import { VerificationService } from './verification.service';
import { WorkflowService } from './workflow.service';
import { MemoryService } from './memory.service';
import { ResourceService } from './resource.service';
import { SimulatorService } from './simulator.service';
import { IntegrationHubService } from './integration-hub.service';
import { WorkflowAction, WorkflowCondition } from './workflow-evaluator';

class PauseDto {
  @IsBoolean()
  paused: boolean;
  @IsOptional()
  @IsString()
  reason?: string;
}

class ReviewDto {
  @IsBoolean()
  approve: boolean;
  @IsOptional()
  @IsString()
  reason?: string;
}

class WorkflowDto {
  @IsString()
  @MinLength(2)
  name: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsString()
  triggerType: string;
  @IsOptional()
  @IsArray()
  conditions?: WorkflowCondition[];
  @IsOptional()
  @IsArray()
  actions?: WorkflowAction[];
  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class MemoryDto {
  @IsEnum(MemoryKind)
  kind: MemoryKind;
  @IsOptional()
  @IsEnum(MemoryProvenance)
  provenance?: MemoryProvenance;
  @IsString()
  @MinLength(2)
  title: string;
  @IsString()
  @MinLength(2)
  content: string;
  @IsOptional()
  @IsString()
  sourceRef?: string;
}

class CapacityDto {
  @IsOptional()
  @IsNumber()
  hoursPerWeek?: number;
  @IsOptional()
  @IsBoolean()
  available?: boolean;
  @IsOptional()
  @IsString()
  unavailableUntil?: string;
  @IsOptional()
  @IsString()
  notes?: string;
}

class ScenarioDto {
  @IsString()
  @MinLength(2)
  name: string;
  @IsString()
  @MinLength(3)
  hypothesis: string;
  @IsOptional()
  @IsObject()
  assumptions?: Record<string, number>;
}

const DirectorRoles = () => Roles(...DIRECTOR_ROLES);

@ApiTags('AI Control Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@DirectorRoles()
@Controller('ops')
export class OpsController {
  constructor(
    private access: CompanyAccessService,
    private ops: OpsService,
  ) {}

  @Get('companies/:companyId/control-center')
  async center(@Param('companyId') companyId: string, @User() user: { sub: string; role: UserRole }) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.ops.controlCenter(companyId);
  }

  @Post('companies/:companyId/pause')
  async pause(
    @Param('companyId') companyId: string,
    @User() user: { sub: string; role: UserRole },
    @Body() dto: PauseDto,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.ops.pause(companyId, user.sub, dto.reason ?? 'Emergency pause', dto.paused);
  }

  @Post('companies/:companyId/operations/:operationId/retry')
  async retry(
    @Param('companyId') companyId: string,
    @Param('operationId') operationId: string,
    @User() user: { sub: string; role: UserRole },
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.ops.retryOperation(companyId, operationId, user.sub);
  }
}

@ApiTags('Verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@DirectorRoles()
@Controller('verification')
export class VerificationController {
  constructor(
    private access: CompanyAccessService,
    private verification: VerificationService,
  ) {}

  @Get('companies/:companyId/reports')
  async list(
    @Param('companyId') companyId: string,
    @User() user: { sub: string; role: UserRole },
    @Query('status') status?: VerificationStatus,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.verification.list(companyId, status);
  }

  @Post('companies/:companyId/reports/:reportId/review')
  async review(
    @Param('companyId') companyId: string,
    @Param('reportId') reportId: string,
    @User() user: { sub: string; role: UserRole },
    @Body() dto: ReviewDto,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.verification.review(companyId, reportId, user.sub, dto.approve, dto.reason);
  }
}

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@DirectorRoles()
@Controller('workflows')
export class WorkflowController {
  constructor(
    private access: CompanyAccessService,
    private workflows: WorkflowService,
  ) {}

  @Get('companies/:companyId')
  async list(@Param('companyId') companyId: string, @User() user: { sub: string; role: UserRole }) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.workflows.list(companyId);
  }

  @Post('companies/:companyId')
  async create(
    @Param('companyId') companyId: string,
    @User() user: { sub: string; role: UserRole },
    @Body() dto: WorkflowDto,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.workflows.create(companyId, user.sub, dto);
  }

  @Put('companies/:companyId/:id')
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @User() user: { sub: string; role: UserRole },
    @Body() dto: Partial<WorkflowDto>,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.workflows.update(companyId, id, dto);
  }

  @Delete('companies/:companyId/:id')
  async remove(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @User() user: { sub: string; role: UserRole },
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.workflows.remove(companyId, id);
  }
}

@ApiTags('Business Memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@DirectorRoles()
@Controller('memory')
export class MemoryController {
  constructor(
    private access: CompanyAccessService,
    private memory: MemoryService,
  ) {}

  @Get('companies/:companyId')
  async list(
    @Param('companyId') companyId: string,
    @User() user: { sub: string; role: UserRole },
    @Query('q') q?: string,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.memory.list(companyId, q);
  }

  @Post('companies/:companyId')
  async create(
    @Param('companyId') companyId: string,
    @User() user: { sub: string; role: UserRole },
    @Body() dto: MemoryDto,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.memory.create(companyId, user.sub, dto);
  }

  @Put('companies/:companyId/:id')
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @User() user: { sub: string; role: UserRole },
    @Body() dto: Partial<MemoryDto> & { archived?: boolean },
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.memory.update(companyId, id, user.sub, dto);
  }

  @Delete('companies/:companyId/:id')
  async remove(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @User() user: { sub: string; role: UserRole },
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.memory.remove(companyId, id);
  }
}

@ApiTags('Resources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@DirectorRoles()
@Controller('resources')
export class ResourceController {
  constructor(
    private access: CompanyAccessService,
    private resources: ResourceService,
  ) {}

  @Get('companies/:companyId')
  async overview(@Param('companyId') companyId: string, @User() user: { sub: string; role: UserRole }) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.resources.overview(companyId);
  }

  @Put('companies/:companyId/employees/:employeeId/capacity')
  async capacity(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @User() user: { sub: string; role: UserRole },
    @Body() dto: CapacityDto,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.resources.upsertCapacity(companyId, employeeId, dto);
  }

  @Get('companies/:companyId/tasks/:taskId/suggest')
  async suggest(
    @Param('companyId') companyId: string,
    @Param('taskId') taskId: string,
    @User() user: { sub: string; role: UserRole },
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.resources.suggestAssignee(companyId, taskId);
  }
}

@ApiTags('Simulator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@DirectorRoles()
@Controller('simulator')
export class SimulatorController {
  constructor(
    private access: CompanyAccessService,
    private simulator: SimulatorService,
  ) {}

  @Get('companies/:companyId')
  async list(@Param('companyId') companyId: string, @User() user: { sub: string; role: UserRole }) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.simulator.list(companyId);
  }

  @Post('companies/:companyId')
  async run(
    @Param('companyId') companyId: string,
    @User() user: { sub: string; role: UserRole },
    @Body() dto: ScenarioDto,
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.simulator.run(companyId, dto.name, dto.hypothesis, dto.assumptions ?? {});
  }
}

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@DirectorRoles()
@Controller('integrations')
export class IntegrationHubController {
  constructor(
    private access: CompanyAccessService,
    private hub: IntegrationHubService,
  ) {}

  @Get('companies/:companyId')
  async list(@Param('companyId') companyId: string, @User() user: { sub: string; role: UserRole }) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.hub.list(companyId);
  }

  @Post('companies/:companyId/:type/connect')
  async connect(
    @Param('companyId') companyId: string,
    @Param('type') type: string,
    @User() user: { sub: string; role: UserRole },
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.hub.connect(companyId, user.sub, type.toUpperCase(), false);
  }

  @Post('companies/:companyId/:type/disconnect')
  async disconnect(
    @Param('companyId') companyId: string,
    @Param('type') type: string,
    @User() user: { sub: string; role: UserRole },
  ) {
    await this.access.assertDirectorCompany(user.sub, user.role, companyId);
    return this.hub.disconnect(companyId, user.sub, type.toUpperCase());
  }
}
