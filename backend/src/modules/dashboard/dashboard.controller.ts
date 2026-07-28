import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('companies/:companyId')
  @ApiOperation({ summary: 'Executive dashboard with KPIs and charts' })
  getExecutive(@Param('companyId') companyId: string) {
    return this.dashboardService.getExecutiveDashboard(companyId);
  }

  @Get('companies/:companyId/manager')
  @ApiOperation({ summary: 'Manager dashboard with team details' })
  getManager(@Param('companyId') companyId: string) {
    return this.dashboardService.getManagerDashboard(companyId);
  }
}
