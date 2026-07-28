export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
    expiresIn: process.env.JWT_EXPIRATION ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? '',
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    modelFast: process.env.GROQ_MODEL_FAST ?? 'llama-3.1-8b-instant',
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? 'auto',
  },
  telegram: {
    apiId: process.env.TELEGRAM_API_ID ?? '',
    apiHash: process.env.TELEGRAM_API_HASH ?? '',
  },
  whatsapp: {
    apiToken: process.env.WHATSAPP_API_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  },
  cron: {
    dailyPlan: process.env.DAILY_PLAN_CRON ?? '30 7 * * *',
    followUp: process.env.FOLLOW_UP_CRON ?? '0 */2 * * *',
  },
});
