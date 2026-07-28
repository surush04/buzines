import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import {
  CreateCompanyDto,
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreateProjectDto,
  UpdateAiSettingsDto,
  UpdateCompanySettingsDto,
  OnboardingDto,
  UpdateBusinessProfileDto,
} from './dto/company.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompanyController {
  constructor(private companyService: CompanyService) {}

  @Post()
  @Roles(UserRole.COMPANY_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new company' })
  create(@User('sub') userId: string, @Body() dto: CreateCompanyDto) {
    return this.companyService.createCompany(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List owned companies' })
  list(@User('sub') userId: string) {
    return this.companyService.getCompanies(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company details' })
  getOne(@Param('id') id: string, @User('sub') userId: string) {
    return this.companyService.getCompany(id, userId);
  }

  @Post(':id/departments')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create department' })
  createDepartment(
    @Param('id') companyId: string,
    @User('sub') userId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.companyService.createDepartment(companyId, userId, dto);
  }

  @Post(':id/employees')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER, UserRole.HR)
  @ApiOperation({ summary: 'Add employee' })
  createEmployee(
    @Param('id') companyId: string,
    @User('sub') userId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.companyService.createEmployee(companyId, userId, dto);
  }

  @Get(':id/employees')
  @ApiOperation({ summary: 'List employees' })
  listEmployees(@Param('id') companyId: string, @User('sub') userId: string) {
    return this.companyService.getEmployees(companyId, userId);
  }

  @Get(':id/employees/:employeeId')
  @ApiOperation({ summary: 'Get employee details with AI profile' })
  getEmployee(
    @Param('id') companyId: string,
    @Param('employeeId') employeeId: string,
    @User('sub') userId: string,
  ) {
    return this.companyService.getEmployee(companyId, employeeId, userId);
  }

  @Post(':id/projects')
  @Roles(UserRole.COMPANY_OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create project (AI will break into tasks)' })
  createProject(
    @Param('id') companyId: string,
    @User('sub') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.companyService.createProject(companyId, userId, dto);
  }

  @Get(':id/projects')
  @ApiOperation({ summary: 'List projects' })
  listProjects(@Param('id') companyId: string, @User('sub') userId: string) {
    return this.companyService.getProjects(companyId, userId);
  }

  @Put(':id/settings')
  @Roles(UserRole.COMPANY_OWNER)
  @ApiOperation({ summary: 'Update company settings' })
  updateSettings(
    @Param('id') companyId: string,
    @User('sub') userId: string,
    @Body() dto: UpdateCompanySettingsDto,
  ) {
    return this.companyService.updateSettings(companyId, userId, dto);
  }

  @Put(':id/ai-settings')
  @Roles(UserRole.COMPANY_OWNER)
  @ApiOperation({ summary: 'Update AI manager settings' })
  updateAiSettings(
    @Param('id') companyId: string,
    @User('sub') userId: string,
    @Body() dto: UpdateAiSettingsDto,
  ) {
    return this.companyService.updateAiSettings(companyId, userId, dto);
  }

  @Put(':id/business-profile')
  @Roles(UserRole.COMPANY_OWNER)
  @ApiOperation({ summary: 'Update business profile for AI context' })
  updateBusinessProfile(
    @Param('id') companyId: string,
    @User('sub') userId: string,
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    return this.companyService.updateBusinessProfile(companyId, userId, dto);
  }

  @Post(':id/onboarding')
  @Roles(UserRole.COMPANY_OWNER)
  @ApiOperation({ summary: 'Complete business onboarding — AI learns about your business' })
  completeOnboarding(
    @Param('id') companyId: string,
    @User('sub') userId: string,
    @Body() dto: OnboardingDto,
  ) {
    return this.companyService.completeOnboarding(companyId, userId, dto);
  }

  @Post(':id/reset-data')
  @Roles(UserRole.COMPANY_OWNER)
  @ApiOperation({ summary: 'Clear tasks, directives, projects — keep business profile & employees' })
  resetData(@Param('id') companyId: string, @User('sub') userId: string) {
    return this.companyService.resetOperationalData(companyId, userId);
  }
}
