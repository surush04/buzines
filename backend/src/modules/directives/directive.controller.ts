import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { DirectiveService } from './directive.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorators';
import { UserRole } from '@prisma/client';

class CreateDirectiveDto {
  @ApiProperty({ example: 'Фуруш зиёд шавад — дар 2 hafta 20% афзоиш' })
  @IsString()
  @MinLength(3)
  instruction: string;

  @ApiPropertyOptional({ description: 'Automatically send tasks via Telegram after creation', default: true })
  @IsOptional()
  @IsBoolean()
  sendTelegram?: boolean;
}

@ApiTags('Admin Directives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('directives')
export class DirectiveController {
  constructor(private directiveService: DirectiveService) {}

  @Post('companies/:companyId')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin gives order — AI splits tasks and sends to employees via Telegram' })
  create(@Param('companyId') companyId: string, @Body() dto: CreateDirectiveDto) {
    return this.directiveService.createAndExecute(
      companyId,
      dto.instruction,
      dto.sendTelegram !== false,
    );
  }

  @Get('companies/:companyId')
  @ApiOperation({ summary: 'List all admin orders and AI execution status' })
  list(@Param('companyId') companyId: string) {
    return this.directiveService.listDirectives(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get directive details with tasks and assignments' })
  getOne(@Param('id') id: string) {
    return this.directiveService.getDirective(id);
  }

  @Post('companies/:companyId/dispatch')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Send existing tasks via Telegram — no new tasks created' })
  dispatchTasks(
    @Param('companyId') companyId: string,
    @Body() body: { directiveId?: string },
  ) {
    return this.directiveService.dispatchExistingTasks(companyId, body?.directiveId);
  }

  @Post('companies/:companyId/auto-analyze')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'AI analyzes full app state and creates tasks if needed' })
  autoAnalyze(@Param('companyId') companyId: string) {
    return this.directiveService.autoAnalyzeAndAct(companyId);
  }

  @Post('companies/:companyId/proactive')
  @Roles(UserRole.COMPANY_OWNER)
  @ApiOperation({ summary: 'AI proactively analyzes business and creates tasks' })
  proactive(@Param('companyId') companyId: string) {
    return this.directiveService.runProactiveManagement(companyId);
  }

  @Post('companies/:companyId/follow-up')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Manually trigger follow-up messages for incomplete tasks' })
  followUp(@Param('companyId') companyId: string) {
    return this.directiveService.followUpIncompleteTasks(companyId);
  }

  @Delete('tasks/:taskId/companies/:companyId')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a task created from admin directive' })
  deleteTask(
    @Param('taskId') taskId: string,
    @Param('companyId') companyId: string,
  ) {
    return this.directiveService.deleteTask(taskId, companyId);
  }

  @Delete(':directiveId/companies/:companyId')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete admin directive with all its tasks' })
  deleteDirective(
    @Param('directiveId') directiveId: string,
    @Param('companyId') companyId: string,
  ) {
    return this.directiveService.deleteDirective(directiveId, companyId);
  }
}
