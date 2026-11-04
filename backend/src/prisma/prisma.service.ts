import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { resolveSqliteFileUrl } from './sqlite-url';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = resolveSqliteFileUrl(process.env.DATABASE_URL);
    super(url ? { datasources: { db: { url } } } : undefined);
    if (url?.startsWith('file:')) this.logger.log('SQLite database configured');
    else if (url) this.logger.log('PostgreSQL database configured');
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
