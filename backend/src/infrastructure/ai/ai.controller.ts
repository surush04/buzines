import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskResponseType } from '@prisma/client';
import { AiEngineService } from './ai-engine.service';
import { BusinessContextService } from './business-context.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorators';
import { UserRole } from '@prisma/client';

class TaskResponseDto {
  @ApiProperty({ enum: TaskResponseType })
  @IsEnum(TaskResponseType)
  responseType: TaskResponseType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

class ChatDto {
  @ApiProperty()
  @IsString()
  message: string;
}

@ApiTags('AI Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(
    private aiEngine: AiEngineService,
    private businessContext: BusinessContextService,
  ) {}

  @Post('projects/:projectId/breakdown')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'AI breaks project into tasks and assigns employees' })
  breakdownProject(@Param('projectId') projectId: string) {
    return this.aiEngine.breakProjectIntoTasks(projectId);
  }

  @Post('companies/:companyId/daily-plans')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Trigger daily plan generation for all employees' })
  generateDailyPlans(@Param('companyId') companyId: string) {
    return this.aiEngine.generateDailyPlans(companyId);
  }

  @Post('employees/:employeeId/tasks/:taskId/respond')
  @ApiOperation({ summary: 'Employee responds to task assignment' })
  respondToTask(
    @Param('employeeId') employeeId: string,
    @Param('taskId') taskId: string,
    @Body() dto: TaskResponseDto,
  ) {
    return this.aiEngine.processEmployeeResponse(
      employeeId,
      taskId,
      dto.message,
    );
  }

  @Post('employees/:employeeId/chat')
  @ApiOperation({ summary: 'Employee chats with AI manager' })
  chat(@Param('employeeId') employeeId: string, @Body() dto: ChatDto) {
    return this.aiEngine.analyzeEmployeeChat(employeeId, dto.message);
  }

  @Get('companies/:companyId/activity')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Recent AI task responses and Telegram chat activity' })
  getActivity(@Param('companyId') companyId: string) {
    return this.aiEngine.getRecentActivity(companyId);
  }

  @Get('companies/:companyId/status')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Live operational snapshot — what AI sees' })
  async getStatus(@Param('companyId') companyId: string) {
    const snapshot = await this.businessContext.getOperationalSnapshot(companyId);
    return { snapshot };
  }

  @Get('companies/:companyId/recommendations')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get AI recommendations for company' })
  getRecommendations(@Param('companyId') companyId: string) {
    return this.aiEngine.generateRecommendations(companyId);
  }

  @Post('companies/:companyId/business-analysis')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'AI full business analysis in company language' })
  analyzeBusiness(@Param('companyId') companyId: string) {
    return this.aiEngine.analyzeBusiness(companyId);
  }
}
