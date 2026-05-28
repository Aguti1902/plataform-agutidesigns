import Anthropic from '@anthropic-ai/sdk';
import { resolveModel } from './models';

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no está configurada en el entorno');
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface RunClaudeOptions {
  model: string;
  system?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  temperature?: number;
}

export interface RunClaudeResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  raw: Anthropic.Message;
}

export async function runClaude(opts: RunClaudeOptions): Promise<RunClaudeResult> {
  const client = getAnthropicClient();
  const model = resolveModel(opts.model);

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
    system: opts.system,
    messages: opts.messages,
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model,
    raw: response,
  };
}

/**
 * Coste estimado en USD para una llamada Claude.
 * Precios oficiales aproximados por 1M tokens (revisar trimestralmente).
 */
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-7': { input: 15, output: 75 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const resolved = resolveModel(model);
  const pricing = PRICING_PER_MTOK[resolved];
  if (!pricing) return 0;
  return (inputTokens * pricing.input) / 1_000_000 + (outputTokens * pricing.output) / 1_000_000;
}
