# Arquitectura

## Principio rector

**Los agentes no se llaman entre sí.** Todos los agentes leen y escriben en Supabase. La coordinación ocurre por eventos en la tabla `events`. Esto da tres propiedades importantes:

1. **Aislamiento de fallos.** Si un agente cae, los demás siguen.
2. **Auditabilidad.** Cada agente registra su ejecución en `agent_runs` con tokens y coste. Sabes en todo momento qué pasó y cuánto costó.
3. **Reemplazabilidad.** Puedes reescribir o sustituir un agente sin tocar el resto, mientras respete el contrato de lectura/escritura.

## Capas

```
┌──────────────────────────────────────────────────────────────────────┐
│  Frontends (Vercel)                                                  │
│  ├─ admin.agutidesigns.io  (apps/mission-control)                    │
│  ├─ lokify.es              (apps/lokify-public)                      │
│  └─ agutidesigns.io        (apps/agutidesigns-public — futuro)       │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │   Supabase JS SSR (@supabase/ssr)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Supabase                                                            │
│  ├─ Auth        (magic link, JWT con role en metadata)               │
│  ├─ Postgres    (esquema v1.0)                                       │
│  │   ├─ Dominio: leads, clientes, webs, presupuestos, facturas       │
│  │   ├─ Orquestación: events                                         │
│  │   ├─ Observabilidad: agent_runs, conversations                    │
│  │   └─ Config: agent_config, nichos                                 │
│  ├─ Storage     (PDFs presupuestos, assets cliente)                  │
│  └─ Edge Functions  ←  los 30 agentes (próximas semanas)             │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │   APIs externas
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Integraciones                                                       │
│  Claude · Stripe · Holded · Wati · Meta Ads · Google Ads             │
│  Gmail MCP · Google Calendar MCP · Ahrefs MCP · fal.ai · Vercel API  │
└──────────────────────────────────────────────────────────────────────┘
```

## Modelo de orquestación por eventos

Un agente publica un evento llamando a la función SQL `publish_event(...)` o usando el helper TS `publishEvent(...)` de `@agutidesigns/shared`.

Triggers Postgres ya emiten eventos automáticamente para casos clave:

- `INSERT INTO leads` → `lead.created`
- `UPDATE leads SET score >= 60` → `lead.qualified`
- `UPDATE webs SET status = 'vivo'` → `web.deployed`

Cada agente declara en `agent_config.trigger_events` los tipos que le interesan. La capa de orquestación (Edge Function `events-dispatcher`, a construir) escanea cada N segundos los eventos sin `processed_at`, los reparte a los agentes registrados y marca `processed_by` cuando han corrido.

Agentes con `cron_schedule != null` se programan vía pg_cron o cron de Vercel y no dependen de eventos.

## Modelos Claude

Política por defecto, configurable por agente en `agent_config.claude_model`:

- **Haiku 4.5** — clasificación, parseo, gestión rutinaria (impagos, reconciliación).
- **Sonnet 4.6** — redacción, análisis estándar, decisiones de negocio.
- **Opus 4.7** — presupuestos, generación de contenido SEO, diseño de campañas.

Coste por ejecución se calcula en `packages/shared/src/claude.ts` con `estimateCostUsd()` y se guarda en `agent_runs.claude_cost_usd`. El agente `dashboard-financiero` lo agrega semanalmente.

## Seguridad

- **RLS activo en todas las tablas.** Solo entidades con `auth.jwt() ->> 'role' = 'admin'` ven todo. Clientes solo ven sus propias filas (mediante el JWT email).
- **Service role key** solo se usa server-side desde Edge Functions y Mission Control SSR (nunca expuesta al navegador).
- **Mission Control** protegido por **dos capas**: basic auth a nivel middleware (perímetro) + magic link Supabase + check `user_metadata.role === 'admin'`.
- **Secretos** nunca en repo: `.env.local` por app, `.gitignore` global. Producción: Vercel env vars + Supabase secrets para Edge Functions.

## Roadmap inmediato

| Semana | Hito |
| --- | --- |
| 1 (hoy) | Monorepo + esquema + Mission Control con auth |
| 2 | D1 captación: `scraper-leads`, `lead-qualifier`, `email-captacion` |
| 3 | D2 ventas: `briefing-reunion`, `generador-presupuesto` |
| 4 | D3 producción: `onboarding`, `content-generator`, `web-builder` |
| 5 | D6 administración: `facturacion-verifactu`, `gestion-impagos` |
| 6+ | D4 ads, D5 atención, resto |
