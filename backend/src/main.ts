import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

function buildCorsOriginChecker(
  frontendUrl: string,
  extraOrigins: string[],
): (origin: string) => boolean {
  return (origin: string): boolean => {
    const allowed = [
      frontendUrl,
      'http://localhost:4200',
      'http://localhost:4201',
      'http://127.0.0.1:4200',
      'http://127.0.0.1:4201',
      ...extraOrigins,
    ];
    if (allowed.includes(origin)) return true;

    const patterns = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^https:\/\/[^/]+\.up\.railway\.app$/,
      /^https:\/\/[^/]+\.railway\.app$/,
      /^https:\/\/[^/]+\.onrender\.com$/,
      /^https:\/\/[^/]+\.loca\.lt$/,
      /^https:\/\/[^/]+\.trycloudflare\.com$/,
      /^https:\/\/[^/]+\.vercel\.app$/,
    ];
    return patterns.some((pattern) => pattern.test(origin));
  };
}

function corsMiddleware(isAllowedOrigin: (origin: string) => boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, X-Requested-With',
      );
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const frontendUrl = configService.get<string>('frontendUrl') ?? 'http://localhost:4201';
  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isAllowedOrigin = buildCorsOriginChecker(frontendUrl, extraOrigins);

  app.use(corsMiddleware(isAllowedOrigin));
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Business Manager API')
    .setDescription('AI-powered business operating platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 AI Business Manager API running on http://127.0.0.1:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Failed to start buzines-api:', err);
  process.exit(1);
});
