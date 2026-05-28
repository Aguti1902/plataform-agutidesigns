import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function LeadsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, marca, nombre_negocio, sector, ciudad, score, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Leads</h1>
      <p className="text-sm text-zinc-500">
        Listado de los últimos 50 leads. Los datos los rellenará{' '}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">scraper-leads</code>.
      </p>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Sector</th>
              <th className="px-4 py-3 font-medium">Ciudad</th>
              <th className="px-4 py-3 font-medium">Marca</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(leads ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                  {error ? error.message : 'Sin leads todavía.'}
                </td>
              </tr>
            )}
            {(leads ?? []).map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-2 text-zinc-900">{lead.nombre_negocio}</td>
                <td className="px-4 py-2 text-zinc-600">{lead.sector}</td>
                <td className="px-4 py-2 text-zinc-600">{lead.ciudad ?? '—'}</td>
                <td className="px-4 py-2 text-zinc-600">{lead.marca}</td>
                <td className="px-4 py-2 text-zinc-900">{lead.score ?? '—'}</td>
                <td className="px-4 py-2 text-zinc-600">{lead.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
