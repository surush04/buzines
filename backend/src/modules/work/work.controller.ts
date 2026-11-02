import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { UserRole } from '@prisma/client';
import { WorkService } from './work.service';

class WorkRespondDto {
  @ApiProperty({ example: 'Фурӯшро анҷом додам, ҳисобот тайёр аст' })
  @IsString()
  @MinLength(2)
  message: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceLinks?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  measurableOutcome?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  claimedValue?: number;
}

@ApiTags('Employee work')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
@Controller('work')
export class WorkController {
  constructor(private work: WorkService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current employee profile and task counts' })
  me(@User('sub') userId: string) {
    return this.work.getMe(userId);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Open and completed tasks for logged-in employee' })
  tasks(@User('sub') userId: string) {
    return this.work.getTasks(userId);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'In-app notifications for employee' })
  notifications(@User('sub') userId: string) {
    return this.work.getNotifications(userId);
  }

  @Post('notifications/read')
  @ApiOperation({ summary: 'Mark employee notifications as read' })
  markRead(@User('sub') userId: string) {
    return this.work.markNotificationsRead(userId);
  }

  @Post('tasks/:taskId/respond')
  @ApiOperation({ summary: 'Employee reports progress; AI evaluates completion' })
  respond(
    @User('sub') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: WorkRespondDto,
  ) {
    return this.work.respond(userId, taskId, dto.message, {
      evidenceLinks: dto.evidenceLinks,
      measurableOutcome: dto.measurableOutcome,
      claimedValue: dto.claimedValue,
    });
  }
}
