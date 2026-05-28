# agutidesigns-platform

Plataforma multi-marca que automatiza completamente dos líneas de negocio:

- **Agutidesigns** (agutidesigns.io) — agencia premium de webs personalizadas (1.500–4.000 €/proyecto). Modelo "tú te reúnes, los agentes ejecutan".
- **Lokify** (lokify.es) — SaaS de webs por suscripción para microempresas españolas (29 / 49 / 79 €/mes). 100% automatizado.

Ambas comparten una sola base de datos Postgres en Supabase (campo `marca` por fila), los **mismos 30 agentes IA** y un **Mission Control** unificado en `admin.agutidesigns.io`.

## Arquitectura en una frase

> Los agentes no se llaman entre sí. Todos leen/escriben Supabase. La tabla `events` orquesta el sistema. Si un agente falla, los demás siguen.

Detalle completo en [`ARCHITECTURE.md`](./ARCHITECTURE.md). Listado de agentes en [`AGENTS.md`](./AGENTS.md).

## Stack

- **Supabase** — Postgres + Auth + Storage + Edge Functions (los 30 agentes vivirán aquí)
- **Vercel** — frontends (Mission Control + landings) y dominios
- **Claude API** — cerebro de los agentes (Sonnet 4.6 por defecto, Opus 4.7 para complejos, Haiku 4.5 para simples)
- **Stripe** — pagos y suscripciones
- **Holded** — facturación + Verifactu (cumplimiento AEAT)
- **Wati** — WhatsApp Business API
- **Meta Ads + Google Ads** — campañas
- **fal.ai** — gateway Kling/Veo/Sora para videos de ads
- **Turborepo + pnpm workspaces** — monorepo

## Estructura

```
agutidesigns-platform/
├── apps/
│   ├── mission-control/      # Next.js 15 — admin.agutidesigns.io ✅ día 1
│   ├── lokify-public/        # Next.js 15 — lokify.es (stub)
│   └── agutidesigns-public/  # Next.js 15 — rediseño futuro (stub)
├── packages/
│   ├── database/             # Tipos TypeScript del esquema Supabase
│   ├── ui/                   # Componentes shadcn-style compartidos
│   └── shared/               # Helpers Claude API + publishEvent
├── supabase/
│   ├── migrations/           # SQL versionado (esquema v1.0 aplicado ✅)
│   ├── functions/            # Edge Functions (los 30 agentes — vacío día 1)
│   └── seed.sql
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .env.example
```

## Setup inicial

### 1. Dependencias

```bash
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
cp apps/mission-control/.env.example apps/mission-control/.env.local
```

Rellena al menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` (proteger Mission Control en producción)

### 3. Vincular Supabase

Primera vez:

```bash
# Login (abre navegador)
supabase login

# Crea el proyecto remoto desde dashboard (https://supabase.com/dashboard)
# y copia el PROJECT_REF (algo como abcd1234efgh5678)

supabase link --project-ref <PROJECT_REF>
supabase db push
```

Esto aplica `supabase/migrations/20260528000001_initial_schema.sql` y deja los 30 agentes pre-cargados en `agent_config`.

Regenerar tipos TypeScript desde el proyecto vinculado:

```bash
pnpm db:types
```

### 4. Crear el usuario admin

Ver [`apps/mission-control/README.md`](./apps/mission-control/README.md#crear-el-usuario-admin-la-primera-vez). El email admin definido en este proyecto es `info@agutidesigns.io`.

### 5. Desarrollo local

```bash
pnpm dev
```

Mission Control en `http://localhost:3000`.

## Deploy

Mission Control se despliega en Vercel apuntando al subdominio `admin.agutidesigns.io`.

```bash
# Desde la raíz
vercel link             # vincular el repo
vercel --prod           # primer deploy
```

Después, en el dashboard de Vercel:

1. Project Settings → Domains → añadir `admin.agutidesigns.io`.
2. Environment Variables → pegar todo `.env.local` (sin la `BASIC_AUTH_*` si quieres dejarlo abierto, o con ellas para proteger temporalmente).
3. Build Settings → "Root Directory" = `apps/mission-control`, "Install Command" y "Build Command" ya vienen del `vercel.json`.

## Convenciones

- **Commits**: `feat: …` / `fix: …` / `chore: …` / `docs: …`
- **TypeScript estricto** en todo el monorepo (config en `tsconfig.base.json`).
- **Nunca** subir secretos. Todo `.env*` está en `.gitignore` (excepto `.env.example`).
- **`@supabase/ssr`** en Next.js, **no** la versión vieja `@supabase/auth-helpers-nextjs`.

## Estado día 1

- [x] Monorepo Turborepo + pnpm
- [x] Esquema Supabase v1.0 (10 tablas, 30 agentes seed, RLS, triggers)
- [x] Mission Control: login magic link, role guard, dashboard, sidebar, agentes con toggle
- [x] Documentación
- [ ] Push a GitHub
- [ ] Crear proyecto Supabase remoto + `db push`
- [ ] Deploy Vercel + DNS `admin.agutidesigns.io`

Los tres últimos requieren acceso a tus cuentas: ver `## Setup inicial` arriba.
