/**
 * IDs canónicos de modelos Claude usados por los agentes.
 *
 * Política por defecto:
 * - Haiku 4.5: tareas simples y de alto volumen (clasificación, parseo)
 * - Sonnet 4.6: tareas estándar (redacción, análisis, decisiones)
 * - Opus 4.7: tareas complejas o creativas (presupuestos, campañas, contenido SEO)
 */

export const CLAUDE_MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
} as const;

export type ClaudeModelKey = keyof typeof CLAUDE_MODELS;
export type ClaudeModelId = (typeof CLAUDE_MODELS)[ClaudeModelKey];

export function resolveModel(modelOrKey: string): string {
  if (modelOrKey in CLAUDE_MODELS) {
    return CLAUDE_MODELS[modelOrKey as ClaudeModelKey];
  }
  return modelOrKey;
}
