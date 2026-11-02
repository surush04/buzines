import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorators';
import { CeoDecisionStatus, UserRole } from '@prisma/client';
import { CeoService } from './ceo.service';
import { User } from '../../common/decorators/user.decorator';

class CreateGoalDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsNumber()
  targetValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;
}

class CreateKpiDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsNumber()
  planValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsNumber()
  factValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;
}

class DecideDto {
  @ApiProperty()
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class VerifyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  actualEffect: string;
}

@ApiTags('AI CEO')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN)
@Controller('ceo')
export class CeoController {
  constructor(private ceo: CeoService) {}

  @Get('companies/:companyId')
  @ApiOperation({ summary: 'AI CEO board: goals, KPIs, issues, morning briefing' })
  board(@Param('companyId') companyId: string) {
    return this.ceo.getBoard(companyId);
  }

  @Get('companies/:companyId/decisions')
  @ApiOperation({ summary: 'Decision journal with filters' })
  journal(
    @Param('companyId') companyId: string,
    @Query('status') status?: CeoDecisionStatus,
    @Query('goalId') goalId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ceo.listDecisions(companyId, { status, goalId, from, to });
  }

  @Post('companies/:companyId/diagnose')
  @ApiOperation({ summary: 'Plan vs fact diagnosis: issues + proposed decisions' })
  diagnose(@Param('companyId') companyId: string) {
    return this.ceo.diagnose(companyId);
  }

  @Post('companies/:companyId/goals')
  createGoal(@Param('companyId') companyId: string, @Body() dto: CreateGoalDto) {
    return this.ceo.createGoal(companyId, dto.title, dto.description, dto.targetValue, dto.unit);
  }

  @Post('companies/:companyId/kpis')
  createKpi(@Param('companyId') companyId: string, @Body() dto: CreateKpiDto) {
    return this.ceo.createKpi(companyId, dto.employeeId, dto.name, dto.planValue, dto.factValue, dto.unit);
  }

  @Post('companies/:companyId/decisions/:decisionId')
  decide(
    @Param('companyId') companyId: string,
    @Param('decisionId') decisionId: string,
    @User('sub') userId: string,
    @Body() dto: DecideDto,
  ) {
    return this.ceo.approveDecision(companyId, decisionId, dto.approve, userId, dto.reason);
  }

  @Post('companies/:companyId/decisions/:decisionId/verify')
  verify(
    @Param('companyId') companyId: string,
    @Param('decisionId') decisionId: string,
    @User('sub') userId: string,
    @Body() dto: VerifyDto,
  ) {
    return this.ceo.verifyDecision(companyId, decisionId, dto.actualEffect, userId);
  }
}
