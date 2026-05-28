import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AgentToggle } from './agent-toggle';

export const dynamic = 'force-dynamic';

export default async function AgentesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: agents, error } = await supabase
    .from('agent_config')
    .select(
      'agent_name, display_name, description, enabled, claude_model, cron_schedule, trigger_events',
    )
    .order('agent_name');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Agentes</h1>
        <p className="text-sm text-zinc-500">
          {agents?.length ?? 0} agentes configurados. Activa o desactiva cada uno desde aquí — el
          cambio persiste en <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">agent_config</code>.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error.message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Agente</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-4 py-3 font-medium">Disparador</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(agents ?? []).map((a) => {
              const trigger =
                a.cron_schedule != null
                  ? `cron · ${a.cron_schedule}`
                  : a.trigger_events && a.trigger_events.length > 0
                    ? `event · ${a.trigger_events.join(', ')}`
                    : 'manual';

              return (
                <tr key={a.agent_name}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{a.display_name}</div>
                    <div className="font-mono text-xs text-zinc-500">{a.agent_name}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{a.description}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{a.claude_model}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{trigger}</td>
                  <td className="px-4 py-3">
                    <AgentToggle agentName={a.agent_name} enabled={a.enabled} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
