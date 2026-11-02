import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpsService } from './ops.service';

const PROVIDERS = ['GOOGLE_CALENDAR', 'GMAIL', 'CRM', 'WHATSAPP', 'TELEGRAM', 'WEBHOOK'] as const;

@Injectable()
export class IntegrationHubService {
  constructor(
    private prisma: PrismaService,
    private ops: OpsService,
  ) {}

  async list(companyId: string) {
    const rows = await this.prisma.integration.findMany({ where: { companyId } });
    const byType = new Map(rows.map((r) => [r.type, r]));
    return PROVIDERS.map((type) => {
      const row = byType.get(type);
      if (!row) {
        return {
          type,
          isActive: false,
          connectionStatus: 'DISCONNECTED',
          lastSyncAt: null,
          lastError: null,
          configured: false,
        };
      }
      return {
        type: row.type,
        isActive: row.isActive && row.connectionStatus === 'CONNECTED',
        connectionStatus: row.connectionStatus,
        lastSyncAt: row.lastSyncAt,
        lastError: row.lastError,
        configured: true,
      };
    });
  }

  async connect(companyId: string, userId: string, type: string, secretPresent: boolean) {
    if (!PROVIDERS.includes(type as (typeof PROVIDERS)[number])) {
      throw new BadRequestException('Unknown provider');
    }
    if (!secretPresent) {
      throw new BadRequestException(
        'Provider credentials are not configured on the server. Add them to backend environment variables, then retry. Connection is not marked successful.',
      );
    }
    throw new BadRequestException(
      `${type} OAuth/API handshake is not completed in this environment. Status remains DISCONNECTED.`,
    );
  }

  async disconnect(companyId: string, userId: string, type: string) {
    const row = await this.prisma.integration.findUnique({
      where: { companyId_type: { companyId, type } },
    });
    if (!row) return { ok: true, connectionStatus: 'DISCONNECTED' };
    await this.prisma.integration.update({
      where: { id: row.id },
      data: { isActive: false, connectionStatus: 'DISCONNECTED', config: {}, lastError: null },
    });
    await this.ops.audit({
      companyId,
      actorUserId: userId,
      action: 'INTEGRATION_DISCONNECT',
      targetType: 'Integration',
      targetId: type,
    });
    return { ok: true, connectionStatus: 'DISCONNECTED' };
  }
}
