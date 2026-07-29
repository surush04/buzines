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

  @Get('companies/:companyId/api-credentials')
  @ApiOperation({ summary: 'Telegram API credentials for company' })
  apiCredentials(@Param('companyId') companyId: string) {
    return this.telegramUser.getApiCredentialsStatus(companyId);
  }

  @Post('companies/:companyId/api-credentials')
  @ApiOperation({ summary: 'Save Telegram API ID and Hash from admin panel' })
  async saveApiCredentials(
    @Param('companyId') companyId: string,
    @Body() body: { apiId: number; apiHash: string },
  ) {
    try {
      return await this.telegramUser.saveApiCredentials(companyId, body.apiId, body.apiHash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(msg || 'API credentials захира нашуд');
    }
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
    const configured = this.telegramUser.isConfiguredFromEnv();
    return {
      mode: 'personal_account',
      configured,
      message: configured
        ? 'Global API credentials in .env — companies can also set their own in Settings'
        : 'Set API ID/Hash in Settings or backend/.env',
    };
  }
}
