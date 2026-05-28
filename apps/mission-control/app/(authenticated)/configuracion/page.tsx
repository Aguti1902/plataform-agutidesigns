import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function ConfiguracionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Configuración</h1>
        <p className="text-sm text-zinc-500">
          Preferencias generales. La configuración de cada agente está en{' '}
          <a className="underline" href="/agentes">
            Agentes
          </a>
          .
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm">
        <div className="font-medium text-zinc-900">Cuenta</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-zinc-600">
          <div>Email</div>
          <div className="text-zinc-900">{user?.email ?? '—'}</div>
          <div>Role</div>
          <div className="text-zinc-900">
            {(user?.user_metadata as Record<string, unknown> | undefined)?.role as string ?? '—'}
          </div>
          <div>User ID</div>
          <div className="break-all font-mono text-xs text-zinc-500">{user?.id ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
