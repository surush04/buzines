import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import { computeCheck } from 'telegram/Password';
import { NewMessage } from 'telegram/events';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEngineService } from '../ai/ai-engine.service';
import { DirectiveService } from '../../modules/directives/directive.service';
import { TaskStatus } from '@prisma/client';

interface PendingAuth {
  phone: string;
  phoneCodeHash: string;
  client: TelegramClient;
  isCodeViaApp?: boolean;
}

@Injectable()
export class TelegramUserService implements OnModuleInit {
  private readonly logger = new Logger(TelegramUserService.name);
  private readonly clients = new Map<string, TelegramClient>();
  private readonly pendingAuth = new Map<string, PendingAuth>();
  private aiEngine: AiEngineService | null = null;
  private directiveService: DirectiveService | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  setHandlers(aiEngine: AiEngineService, directiveService: DirectiveService) {
    this.aiEngine = aiEngine;
    this.directiveService = directiveService;
  }

  async onModuleInit() {
    const integrations = await this.prisma.integration.findMany({
      where: { type: 'TELEGRAM_USER', isActive: true },
    });
    for (const integration of integrations) {
      const config = integration.config as { session?: string };
      if (config.session) {
        try {
          await this.connectClient(integration.companyId, config.session);
          this.logger.log(`Telegram user restored for company ${integration.companyId}`);
        } catch (err) {
          this.logger.error(`Failed to restore Telegram user for ${integration.companyId}`, err);
        }
      }
    }
  }

  private getApiCredentials() {
    const apiId = parseInt(this.configService.get<string>('telegram.apiId') ?? '0', 10);
    const apiHash = this.configService.get<string>('telegram.apiHash') ?? '';
    return { apiId, apiHash };
  }

  isConfigured() {
    const { apiId, apiHash } = this.getApiCredentials();
    return apiId > 0 && apiHash.length > 0;
  }

  isConnected(companyId: string) {
    return this.clients.has(companyId);
  }

  async getStatus(companyId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { companyId_type: { companyId, type: 'TELEGRAM_USER' } },
    });
    const config = (integration?.config ?? {}) as { username?: string; phone?: string };
    return {
      configured: this.isConfigured(),
      connected: this.isConnected(companyId),
      username: config.username ?? null,
      phone: config.phone ?? null,
      mode: 'personal_account',
    };
  }

  private getClientOptions() {
    return {
      connectionRetries: 3,
      useWSS: true,
    };
  }

  private getErrorMessage(err: unknown): string {
    if (err && typeof err === 'object') {
      const rpc = err as { errorMessage?: string; message?: string };
      return rpc.errorMessage ?? rpc.message ?? String(err);
    }
    return String(err);
  }

  private normalizePhoneCode(code: string): string {
    return code.replace(/\D/g, '');
  }

  private mapAuthError(err: unknown): Error {
    const msg = this.getErrorMessage(err);
    if (msg.includes('PHONE_CODE_INVALID')) {
      return new Error(
        'Коди OTP нодуруст. Коди навтаринро аз Telegram гиред. Агар OTP-ро дубора фиристода бошед, коди қадим кор намекунад.',
      );
    }
    if (msg.includes('PHONE_CODE_EXPIRED')) {
      return new Error('Коди OTP мӯҳлаташ гузашт. "OTP фиристодан"-ро пахш кунед ва кодро нав гиред.');
    }
    if (msg.includes('SESSION_PASSWORD_NEEDED')) {
      return new Error('Пароли дуруҷа (2FA) лозим аст');
    }
    return err instanceof Error ? err : new Error(msg);
  }

  private async savePendingAuthState(
    companyId: string,
    phone: string,
    phoneCodeHash: string,
    isCodeViaApp?: boolean,
  ) {
    await this.prisma.integration.upsert({
      where: { companyId_type: { companyId, type: 'TELEGRAM_USER' } },
      create: {
        companyId,
        type: 'TELEGRAM_USER',
        isActive: false,
        config: {
          pendingPhone: phone,
          phoneCodeHash,
          isCodeViaApp,
          pendingAt: new Date().toISOString(),
        },
      },
      update: {
        isActive: false,
        config: {
          pendingPhone: phone,
          phoneCodeHash,
          isCodeViaApp,
          pendingAt: new Date().toISOString(),
        },
      },
    });
  }

  private async restorePendingAuth(companyId: string): Promise<PendingAuth | null> {
    const integration = await this.prisma.integration.findUnique({
      where: { companyId_type: { companyId, type: 'TELEGRAM_USER' } },
    });
    const config = (integration?.config ?? {}) as {
      pendingPhone?: string;
      phoneCodeHash?: string;
      isCodeViaApp?: boolean;
      pendingAt?: string;
    };

    if (!config.pendingPhone || !config.phoneCodeHash) return null;

    if (config.pendingAt) {
      const ageMs = Date.now() - new Date(config.pendingAt).getTime();
      if (ageMs > 10 * 60 * 1000) return null;
    }

    const { apiId, apiHash } = this.getApiCredentials();
    const client = new TelegramClient(new StringSession(''), apiId, apiHash, this.getClientOptions());
    await this.withTimeout(
      client.connect(),
      30000,
      'Пайвастшавӣ ба Telegram вақт гузашт',
    );

    return {
      phone: config.pendingPhone,
      phoneCodeHash: config.phoneCodeHash,
      client,
      isCodeViaApp: config.isCodeViaApp,
    };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  }

  private async clearPendingAuth(companyId: string) {
    const pending = this.pendingAuth.get(companyId);
    if (pending) {
      try {
        await pending.client.disconnect();
      } catch {
        /* ignore */
      }
      this.pendingAuth.delete(companyId);
    }
  }

  async sendLoginCode(companyId: string, phone: string) {
    const { apiId, apiHash } = this.getApiCredentials();
    if (!apiId || !apiHash) {
      throw new Error('TELEGRAM_API_ID ва TELEGRAM_API_HASH дар .env гузоред (my.telegram.org)');
    }

    await this.clearPendingAuth(companyId);

    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    this.logger.log(`Sending Telegram OTP to ${normalizedPhone} for company ${companyId}`);

    const client = new TelegramClient(new StringSession(''), apiId, apiHash, this.getClientOptions());

    try {
      await this.withTimeout(
        client.connect(),
        30000,
        'Пайвастшавӣ ба Telegram вақт гузашт — интернет ё VPN-ро санҷед',
      );

      const result = await this.withTimeout(
        client.sendCode({ apiId, apiHash }, normalizedPhone),
        30000,
        'OTP фиристода нашуд — бори дигар кӯшиш кунед',
      );

      this.pendingAuth.set(companyId, {
        phone: normalizedPhone,
        phoneCodeHash: result.phoneCodeHash,
        client,
        isCodeViaApp: result.isCodeViaApp,
      });

      await this.savePendingAuthState(
        companyId,
        normalizedPhone,
        result.phoneCodeHash,
        result.isCodeViaApp,
      );

      this.logger.log(`Telegram OTP sent to ${normalizedPhone}`);
      return {
        sent: true,
        phone: normalizedPhone,
        isCodeViaApp: result.isCodeViaApp,
        hint: result.isCodeViaApp
          ? 'Кодро дар барномаи Telegram (чати "Telegram") бинед'
          : 'Кодро дар SMS бинед',
      };
    } catch (err) {
      try {
        await client.disconnect();
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  async confirmLogin(companyId: string, code: string, password?: string) {
    let pending = this.pendingAuth.get(companyId);
    if (!pending) {
      pending = (await this.restorePendingAuth(companyId)) ?? undefined;
      if (pending) this.pendingAuth.set(companyId, pending);
    }
    if (!pending) {
      throw new Error('Аввал "OTP фиристодан"-ро пахш кунед ва кодро гиред');
    }

    const phoneCode = this.normalizePhoneCode(code);
    if (!phoneCode || phoneCode.length < 4) {
      throw new Error('Коди OTP нодуруст нависед');
    }

    try {
      await pending.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: pending.phone,
          phoneCodeHash: pending.phoneCodeHash,
          phoneCode,
        }),
      );
    } catch (err: unknown) {
      const msg = this.getErrorMessage(err);
      if (msg.includes('SESSION_PASSWORD_NEEDED') && password) {
        const pwd = await pending.client.invoke(new Api.account.GetPassword());
        const check = await computeCheck(pwd, password);
        await pending.client.invoke(new Api.auth.CheckPassword({ password: check }));
      } else if (msg.includes('SESSION_PASSWORD_NEEDED')) {
        throw new Error('Пароли дуруҷа (2FA) лозим аст');
      } else {
        throw this.mapAuthError(err);
      }
    }

    const session = (pending.client.session as StringSession).save() as string;
    const me = await pending.client.getMe();
    const username = me.username ?? null;

    await this.prisma.integration.upsert({
      where: { companyId_type: { companyId, type: 'TELEGRAM_USER' } },
      create: {
        companyId,
        type: 'TELEGRAM_USER',
        isActive: true,
        config: { session, phone: pending.phone, username },
      },
      update: {
        isActive: true,
        config: { session, phone: pending.phone, username },
      },
    });

    this.clients.set(companyId, pending.client);
    this.pendingAuth.delete(companyId);
    this.attachMessageHandler(companyId, pending.client);

    return { connected: true, username, phone: pending.phone };
  }

  private async connectClient(companyId: string, session: string) {
    const existing = this.clients.get(companyId);
    if (existing) {
      try {
        await existing.disconnect();
      } catch {
        /* ignore */
      }
      this.clients.delete(companyId);
    }

    const { apiId, apiHash } = this.getApiCredentials();
    const client = new TelegramClient(new StringSession(session), apiId, apiHash, this.getClientOptions());
    await this.withTimeout(
      client.connect(),
      30000,
      'Пайвастшавӣ ба Telegram вақт гузашт',
    );
    this.clients.set(companyId, client);
    this.attachMessageHandler(companyId, client);
    return client;
  }

  async sendMessage(
    companyId: string,
    username: string,
    message: string,
  ): Promise<{ sent: boolean; reason?: string }> {
    let client = this.clients.get(companyId);
    if (!client) {
      const integration = await this.prisma.integration.findUnique({
        where: { companyId_type: { companyId, type: 'TELEGRAM_USER' } },
      });
      const config = integration?.config as { session?: string } | undefined;
      if (!config?.session) return { sent: false, reason: 'account_not_connected' };
      client = await this.connectClient(companyId, config.session);
    }

    const clean = username.replace(/^@/, '').trim();
    const target = `@${clean}`;
    try {
      const entity = await client.getEntity(target);
      await client.sendMessage(entity, { message });
      return { sent: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send to ${target}: ${msg}`);

      if (/USERNAME_NOT_OCCUPIED|USERNAME_INVALID/i.test(msg)) {
        return { sent: false, reason: 'username_invalid' };
      }
      if (/PRIVACY|USER_PRIVACY|PEER_ID_INVALID|Could not find/i.test(msg)) {
        return {
          sent: false,
          reason: 'privacy_blocked',
        };
      }
      return { sent: false, reason: 'send_failed' };
    }
  }

  private attachMessageHandler(companyId: string, client: TelegramClient) {
    client.addEventHandler(async (event) => {
      try {
        const message = event.message;
        if (!message || !message.text) return;
        if (message.out) return;

        const sender = await message.getSender();
        if (!sender || !('username' in sender) || !sender.username) return;

        this.logger.log(`Telegram inbound from @${sender.username}: ${message.text.slice(0, 80)}`);

        const employee = await this.findEmployeeByUsername(companyId, sender.username);
        if (!employee) {
          this.logger.warn(`Unknown Telegram user @${sender.username} for company ${companyId}`);
          return;
        }
        if (!this.aiEngine || !this.directiveService) return;

        const assignment = employee.taskAssignments[0];

        if (!assignment) {
          const reply = await this.aiEngine.analyzeEmployeeChat(employee.id, message.text);
          await this.sendMessage(companyId, employee.telegramUsername!, reply);
          return;
        }

        const result = await this.aiEngine.processEmployeeResponse(
          employee.id,
          assignment.taskId,
          message.text,
        );
        await this.sendMessage(companyId, employee.telegramUsername!, result.reply);
      } catch (err) {
        this.logger.error('Telegram user message handler error', err);
      }
    }, new NewMessage({ incoming: true }));
  }

  private async findEmployeeByUsername(companyId: string, username: string) {
    const normalized = username.replace(/^@/, '').toLowerCase();
    const employees = await this.prisma.employee.findMany({
      where: { companyId, telegramUsername: { not: null } },
      include: {
        taskAssignments: {
          where: { status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } },
          orderBy: { assignedAt: 'desc' },
          take: 1,
          include: { task: { include: { project: true } } },
        },
      },
    });

    return employees.find(
      (e) => e.telegramUsername?.replace(/^@/, '').toLowerCase() === normalized,
    ) ?? null;
  }
}
