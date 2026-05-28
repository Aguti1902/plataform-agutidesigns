# mission-control

Panel admin unificado de Agutidesigns + Lokify (`admin.agutidesigns.io`).

Stack: Next.js 15 (App Router) · React 19 · Tailwind 4 · Supabase SSR · TypeScript estricto.

## Desarrollo local

```bash
# Desde la raíz del monorepo
pnpm install
cp apps/mission-control/.env.example apps/mission-control/.env.local
# rellena las variables (NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, etc.)

pnpm --filter @agutidesigns/mission-control dev
```

Abre `http://localhost:3000/login` y pide el magic link al email que tenga `role:'admin'` en `raw_user_meta_data`.

## Auth y guards

1. **Basic Auth** (perímetro). Si `BASIC_AUTH_USER` y `BASIC_AUTH_PASSWORD` están definidos, toda request entra primero por aquí. Útil para proteger el dominio antes de que terceros puedan llegar. Para desactivarlo, deja ambas vacías.
2. **Supabase Auth + role guard**. El middleware refresca la sesión y exige `user_metadata.role === 'admin'`. Si no se cumple, redirige a `/login`.

## Estructura

```
app/
├── layout.tsx                 # raíz HTML
├── login/                     # magic link
├── auth/callback/             # exchange code → cookie session
└── (authenticated)/
    ├── layout.tsx             # sidebar + header
    ├── page.tsx               # dashboard
    ├── leads, clientes, ...
    └── agentes/               # listado + toggle (server action)
components/
lib/
├── env.ts
└── supabase/{client,server,middleware}.ts
middleware.ts                  # basic auth + supabase session refresh
```

## Crear el usuario admin la primera vez

Hasta que tengas el primer admin no podrás entrar. Dos opciones:

**A) SQL (recomendado)**

```sql
-- Tras `supabase db push`, en el SQL editor del proyecto Supabase:
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'info@agutidesigns.io',
  jsonb_build_object('role', 'admin'),
  NOW(), NOW(), NOW()
);
```

**B) CLI**

```bash
supabase auth users create info@agutidesigns.io --user-metadata '{"role":"admin"}'
```

Después pide magic link en `/login` con `info@agutidesigns.io`.
