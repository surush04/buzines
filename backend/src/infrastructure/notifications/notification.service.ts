import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationChannel, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  async send(
    employeeId: string,
    type: NotificationType,
    title: string,
    content: string,
    channels: NotificationChannel[] = [NotificationChannel.IN_APP],
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) return;

    for (const channel of channels) {
      if (channel !== NotificationChannel.IN_APP) continue;
      await this.prisma.notification.create({
        data: { employeeId, type, channel, title, content, sentAt: new Date() },
      });
      this.logger.log(`In-app notification to ${employee.firstName}: ${title}`);
    }
  }
}
