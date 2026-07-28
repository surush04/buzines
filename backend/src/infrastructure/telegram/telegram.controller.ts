import { Controller, Post, Get, Body, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TelegramUserService } from './telegram-user.service';

@ApiTags('Telegram')
@ApiBearerAuth()
@Controller('telegram')
export class TelegramController {
  constructor(private telegramUser: TelegramUserService) {}

  @Get('companies/:companyId/user/status')
  @ApiOperation({ summary: 'Personal Telegram account status' })
  userStatus(@Param('companyId') companyId: string) {
    return this.telegramUser.getStatus(companyId);
  }

  @Post('companies/:companyId/user/send-code')
  @ApiOperation({ summary: 'Send OTP to connect personal Telegram' })
  async userSendCode(
    @Param('companyId') companyId: string,
    @Body() body: { phone: string },
  ) {
    try {
      return await this.telegramUser.sendLoginCode(companyId, body.phone);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(msg || 'OTP фиристода нашуд');
    }
  }

  @Post('companies/:companyId/user/confirm')
  @ApiOperation({ summary: 'Confirm OTP — connect personal Telegram' })
  async userConfirm(
    @Param('companyId') companyId: string,
    @Body() body: { code: string; password?: string },
  ) {
    try {
      return await this.telegramUser.confirmLogin(companyId, body.code, body.password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(msg || 'Пайвастшавӣ номуваффақ');
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Telegram setup status (personal account only)' })
  async status() {
    return {
      mode: 'personal_account',
      configured: this.telegramUser.isConfigured(),
      message: this.telegramUser.isConfigured()
        ? 'API credentials OK — connect via Settings OTP'
        : 'Set TELEGRAM_API_ID and TELEGRAM_API_HASH in backend/.env',
    };
  }
}
