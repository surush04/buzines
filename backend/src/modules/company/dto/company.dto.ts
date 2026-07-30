import { IsString, IsOptional, IsArray, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectPriority, ProjectStatus } from '@prisma/client';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Technology' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class CreateEmployeeDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Berjandi04', description: 'Telegram username (без @)' })
  @IsString()
  telegramUsername: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiProperty({ example: 'Frontend Developer' })
  @IsString()
  role: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];
}

export class CreateProjectDto {
  @ApiProperty({ example: 'Develop CRM System' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-08-30T00:00:00.000Z' })
  @IsString()
  deadline: string;

  @ApiPropertyOptional({ enum: ProjectPriority })
  @IsOptional()
  @IsEnum(ProjectPriority)
  priority?: ProjectPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateProjectStatusDto {
  @ApiProperty({ enum: ProjectStatus })
  @IsEnum(ProjectStatus)
  status: ProjectStatus;
}

export class UpdateAiSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  autonomyLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  personality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customPrompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessContext?: string;

  @ApiPropertyOptional()
  @IsOptional()
  enableAutoAssign?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  enableSmartAnalysis?: boolean;
}

export class OnboardingDto {
  @ApiProperty({ example: 'Buzines Shop' })
  @IsString()
  companyName: string;

  @ApiProperty({ example: 'Retail / Фуруш' })
  @IsString()
  industry: string;

  @ApiPropertyOptional({ example: 'retail' })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  teamSize?: number;

  @ApiProperty({ example: 'Мағозаи пушак дар Душанбе...' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'Пушак, кафш, аксессуарҳо...' })
  @IsString()
  products: string;

  @ApiProperty({ example: 'Занони 20-45 сол, оилаҳои миёна...' })
  @IsString()
  customers: string;

  @ApiProperty({ example: 'Фуруши миёна 5000 сомонӣ/моҳ, 3 коргар...' })
  @IsString()
  currentState: string;

  @ApiProperty({ example: 'Фуруш 30% зиёд, Instagram маркетинг...' })
  @IsString()
  goals: string;

  @ApiProperty({ example: 'Мушкилот...' })
  @IsString()
  challenges: string;

  @ApiProperty({ example: 'Душанbe, Тоҷикистон' })
  @IsString()
  location: string;

  @ApiProperty({ example: 'B2C offline' })
  @IsString()
  businessModel: string;

  @ApiProperty({ example: 'Instagram, мағоза, телефон' })
  @IsString()
  salesChannels: string;

  @ApiProperty({ example: 'Рақибони асосӣ дар минтақа' })
  @IsString()
  competitors: string;

  @ApiProperty({ example: 'Менеджер, фурӯшанда, бухгалтер' })
  @IsString()
  teamStructure: string;

  @ApiProperty({ example: 'Субҳ нақша, рӯз фуруш, шом гузориш' })
  @IsString()
  workProcesses: string;

  @ApiProperty({ example: 'Фуруши моҳона, муштариёни нав, маржа' })
  @IsString()
  kpis: string;

  @ApiProperty({ example: 'Дӯстона, зуд, бо эмодзи' })
  @IsString()
  customerCommunication: string;

  @ApiProperty({ example: 'Сари вақт, гузориши натиҷа, савол пурсида' })
  @IsString()
  employeeExpectations: string;

  @ApiPropertyOptional({ example: 'Excel, 1C, Telegram' })
  @IsOptional()
  @IsString()
  toolsAndSystems?: string;

  @ApiPropertyOptional({ example: 'Тирамоҳ фурӯши зиёд' })
  @IsOptional()
  @IsString()
  seasonality?: string;

  @ApiPropertyOptional({ example: 'Иттилооти иловагӣ барои AI...' })
  @IsOptional()
  @IsString()
  businessContext?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  autonomyLevel?: string;

  @ApiPropertyOptional({ example: 'ru' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class UpdateBusinessProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessContext?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  autonomyLevel?: string;
}

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  workingHoursStart?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  workingHoursEnd?: string;

  @ApiPropertyOptional({ example: '07:30' })
  @IsOptional()
  @IsString()
  dailyPlanTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;
}
