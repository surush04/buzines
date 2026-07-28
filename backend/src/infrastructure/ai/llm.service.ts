import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

type ChatParams = Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, 'model'> & {
  model?: string;
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private openai: OpenAI | null = null;
  private groq: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const openaiKey = this.configService.get<string>('openai.apiKey');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }

    const groqKey = this.configService.get<string>('groq.apiKey');
    if (groqKey) {
      this.groq = new OpenAI({
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
  }

  isAvailable(): boolean {
    return !!(this.openai || this.groq);
  }

  activeProvider(): 'openai' | 'groq' | 'none' {
    const preferred = this.configService.get<string>('ai.provider') ?? 'auto';
    if (preferred === 'groq' && this.groq) return 'groq';
    if (preferred === 'openai' && this.openai) return 'openai';
    if (this.groq && preferred === 'groq') return 'groq';
    if (this.groq && !this.openai) return 'groq';
    if (this.openai) return 'openai';
    if (this.groq) return 'groq';
    return 'none';
  }

  private getOpenAiModel(fast = false): string {
    return fast
      ? 'gpt-4o-mini'
      : (this.configService.get<string>('openai.model') ?? 'gpt-4o');
  }

  private getGroqModel(fast = false): string {
    return fast
      ? (this.configService.get<string>('groq.modelFast') ?? 'llama-3.1-8b-instant')
      : (this.configService.get<string>('groq.model') ?? 'llama-3.3-70b-versatile');
  }

  async chat(params: ChatParams, fast = false): Promise<OpenAI.Chat.ChatCompletion> {
    const preferred = this.configService.get<string>('ai.provider') ?? 'auto';

    if (preferred === 'groq' && this.groq) {
      return this.callGroq(params, fast);
    }

    if (this.openai && preferred !== 'groq') {
      const request = { ...params, model: params.model ?? this.getOpenAiModel(fast) };
      try {
        return await this.openai.chat.completions.create(request);
      } catch (err) {
        if (this.isQuotaError(err) && this.groq) {
          this.logger.warn('OpenAI quota exceeded — switching to Groq');
          return this.callGroq(params, fast);
        }
        throw err;
      }
    }

    if (this.groq) {
      return this.callGroq(params, fast);
    }

    throw new Error('No LLM configured');
  }

  isQuotaError(err: unknown): boolean {
    const e = err as { status?: number; code?: string; error?: { code?: string } };
    return (
      e?.status === 429 ||
      e?.code === 'insufficient_quota' ||
      e?.error?.code === 'insufficient_quota'
    );
  }

  private async callGroq(params: ChatParams, fast = false): Promise<OpenAI.Chat.ChatCompletion> {
    const groqModel = this.getGroqModel(fast);
    return this.groq!.chat.completions.create({ ...params, model: groqModel });
  }
}
