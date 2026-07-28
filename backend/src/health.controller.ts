import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/auth.decorators';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { ok: true, service: 'buzines-api', ts: new Date().toISOString() };
  }
}
