import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const frontendUrl = configService.get<string>('frontendUrl') ?? 'http://localhost:4201';
  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      const allowed = [
        frontendUrl,
        'http://localhost:4200',
        'http://localhost:4201',
        'http://127.0.0.1:4200',
        'http://127.0.0.1:4201',
        ...extraOrigins,
      ];
      if (
        allowed.includes(origin) ||
        /\.trycloudflare\.com$/i.test(origin) ||
        /\.onrender\.com$/i.test(origin) ||
        /\.railway\.app$/i.test(origin) ||
        /\.up\.railway\.app$/i.test(origin) ||
        /\.vercel\.app$/i.test(origin) ||
        /\.loca\.lt$/i.test(origin)
      ) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
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

bootstrap();
