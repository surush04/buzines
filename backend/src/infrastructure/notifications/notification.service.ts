import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { TelegramUserService } from '../telegram/telegram-user.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private telegramUser: TelegramUserService,
  ) {}

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
      await this.prisma.notification.create({
        data: { employeeId, type, channel, title, content, sentAt: new Date() },
      });

      switch (channel) {
        case NotificationChannel.TELEGRAM:
          await this.sendTelegramToEmployee(employee, content);
          break;
        case NotificationChannel.WHATSAPP:
          this.logger.warn(`WhatsApp not configured for ${employee.firstName}`);
          break;
        case NotificationChannel.EMAIL:
          this.logger.log(`Email to ${employee.email}: ${title}`);
          break;
      }
    }
  }

  async sendTelegramToEmployee(
    employee: {
      companyId: string;
      telegramUsername?: string | null;
      firstName: string;
    },
    message: string,
  ): Promise<{ sent: boolean; reason?: string }> {
    if (!employee.telegramUsername) {
      this.logger.warn(`Telegram: ${employee.firstName} — username нест`);
      return { sent: false, reason: 'username_needs' };
    }

    if (!(await this.telegramUser.isConfigured(employee.companyId))) {
      this.logger.warn(
        'Telegram: API ID/Hash дар Танзимот → Telegram гузоред (my.telegram.org)',
      );
      return { sent: false, reason: 'api_not_configured' };
    }

    if (!this.telegramUser.isConnected(employee.companyId)) {
      this.logger.warn(
        'Telegram: аккаунти шахсӣ пайваст нест — Танзимот → OTP',
      );
      return { sent: false, reason: 'account_not_connected' };
    }

    const sent = await this.telegramUser.sendMessage(
      employee.companyId,
      employee.telegramUsername,
      message,
    );

    if (sent.sent) {
      this.logger.log(`Telegram sent to @${employee.telegramUsername}`);
      return { sent: true };
    }

    this.logger.warn(
      `Telegram not sent to @${employee.telegramUsername} — ${sent.reason ?? 'unknown'}`,
    );
    return { sent: false, reason: sent.reason ?? 'send_failed' };
  }

  telegramReasonMessage(reason?: string): string {
    const map: Record<string, string> = {
      username_needs: 'Коргар username надорад',
      api_not_configured: 'API ID/Hash дар Танзимот → Telegram гузоред',
      account_not_connected: 'Telegram-и шахсӣ пайваст нест — Танзимот → OTP',
      send_failed: 'Ирсол номуваффақ',
      username_invalid: 'Username нодуруст ё вуҷуд надорад',
      privacy_blocked:
        'Telegram иҷозат намедиҳад — коргар бояд аввал ба шумо навишад ё privacy-ро кушояд',
    };
    return map[reason ?? ''] ?? 'Telegram ирсол нашуд';
  }
}
