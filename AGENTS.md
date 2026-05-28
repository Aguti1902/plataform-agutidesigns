# Agentes

30 agentes IA orquestados desde Supabase. Cada agente:

- Está registrado en la tabla `agent_config` (nombre, modelo, schedule, eventos).
- Se ejecuta como una Edge Function de Supabase (a construir en próximas semanas).
- Lee del estado actual de Postgres, hace su trabajo, escribe el resultado en las tablas correspondientes y publica un evento si procede.
- Loguea cada ejecución en `agent_runs` (estado, duración, tokens, coste).

Los 30 agentes están pre-cargados en `agent_config` por la migración inicial — `enabled = true` por defecto pero todavía sin Edge Function detrás. Día 1 deja la base. Cada agente se construye en su semana.

## D1 — Captación (7 agentes)

| Agente | Modelo | Disparador | Propósito |
| --- | --- | --- | --- |
| `scraper-leads` | sonnet-4-6 | cron `0 3 * * *` | Busca negocios locales sin web por sector y ciudad |
| `lead-qualifier` | haiku-4-5 | `lead.created` | Puntúa cada lead 0–100 |
| `nicho-hunter` | sonnet-4-6 | cron `0 2 * * 1` | Detecta sectores rentables semanalmente |
| `email-captacion` | sonnet-4-6 | `lead.qualified` | Email personalizado por sector |
| `whatsapp-outreach` | sonnet-4-6 | `lead.qualified` | Contacta leads por WhatsApp |
| `ads-manager` | opus-4-7 | manual | Crea campañas Meta y Google por nicho |
| `competitor-spy` | sonnet-4-6 | cron `0 6 * * 5` | Monitoriza agencias rivales |

## D2 — Ventas (4 agentes)

| Agente | Modelo | Disparador | Propósito |
| --- | --- | --- | --- |
| `crm-pipeline` | haiku-4-5 | `lead.contacted` | Mueve leads por el pipeline |
| `briefing-reunion` | sonnet-4-6 | `meeting.scheduled` | Prepara briefing 30 min antes |
| `generador-presupuesto` | opus-4-7 | `meeting.completed` | PDF con 3 planes |
| `seguimiento-presupuesto` | sonnet-4-6 | cron `0 10 * * *` | Recordatorios y descuentos |

## D3 — Producción (6 agentes)

| Agente | Modelo | Disparador | Propósito |
| --- | --- | --- | --- |
| `onboarding` | sonnet-4-6 | `payment.received` | Formulario inteligente post-pago |
| `content-generator` | opus-4-7 | `onboarding.completed` | Textos SEO por sector y ciudad |
| `web-builder` | sonnet-4-6 | `content.generated` | Despliega en Vercel |
| `qa-automatico` | sonnet-4-6 | `web.deployed` | Verifica web antes de entregar |
| `google-business` | sonnet-4-6 | `qa.passed` | Ficha Google del cliente |
| `chatbot-embed` | haiku-4-5 | `qa.passed` | Chatbot IA en web cliente |

## D4 — Ads & creatividad (3 agentes)

| Agente | Modelo | Disparador | Propósito |
| --- | --- | --- | --- |
| `video-creator` | sonnet-4-6 | manual | Genera videos para ads con Kling |
| `ad-copywriter` | sonnet-4-6 | manual | Copies de anuncios |
| `social-publisher` | sonnet-4-6 | cron `0 9 * * *` | Publica en IG y TikTok |

## D5 — Atención al cliente (5 agentes)

| Agente | Modelo | Disparador | Propósito |
| --- | --- | --- | --- |
| `email-entrega` | sonnet-4-6 | `qa.passed` | Bienvenida con web + upsells |
| `support-bot` | sonnet-4-6 | `email.received` | Responde emails de clientes |
| `reviews-manager` | sonnet-4-6 | cron `0 11 * * *` | Pide y responde reseñas |
| `retencion-upsell` | sonnet-4-6 | cron `0 9 * * 1` | Lunes: inactivos y upsells |
| `informe-seo` | sonnet-4-6 | cron `0 8 1 * *` | Día 1 de mes: informe a cada cliente |

## D6 — Administración (5 agentes)

| Agente | Modelo | Disparador | Propósito |
| --- | --- | --- | --- |
| `facturacion-verifactu` | haiku-4-5 | `payment.received`, `quote.accepted` | Holded + Verifactu legal |
| `kit-digital` | sonnet-4-6 | manual | Gestiona subvención del cliente |
| `gestion-impagos` | haiku-4-5 | cron `0 8 * * *` | Avisos y pausas automáticas |
| `reconciliacion` | haiku-4-5 | cron `0 7 * * 0` | Stripe vs Holded |
| `dashboard-financiero` | sonnet-4-6 | cron `0 8 * * 1` | MRR, churn, proyección |

## Cómo se construye cada agente

Plantilla recomendada para cada Edge Function (`supabase/functions/<agent-name>/index.ts`):

```ts
import { createClient } from '@supabase/supabase-js';
import { runClaude, estimateCostUsd } from '@agutidesigns/shared';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Abre agent_run
  const { data: run } = await supabase
    .from('agent_runs')
    .insert({ agent_name: '<agent-name>', triggered_by: 'event', /*...*/ })
    .select('id')
    .single();

  try {
    // 2. Lee estado relevante de Postgres (no llamar a otros agentes)
    // 3. Llama a Claude / APIs externas
    const result = await runClaude({ model: 'sonnet', /*...*/ });

    // 4. Escribe el resultado en las tablas de dominio
    // 5. Publica eventos si procede

    // 6. Cierra run con éxito y coste
    await supabase.from('agent_runs').update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      claude_tokens_input: result.inputTokens,
      claude_tokens_output: result.outputTokens,
      claude_cost_usd: estimateCostUsd(result.model, result.inputTokens, result.outputTokens),
      output: { /*...*/ },
    }).eq('id', run!.id);

    return new Response('ok');
  } catch (e) {
    await supabase.from('agent_runs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_message: e instanceof Error ? e.message : String(e),
    }).eq('id', run!.id);
    throw e;
  }
});
```
