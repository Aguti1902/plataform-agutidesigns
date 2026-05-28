import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function ClientesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, marca, nombre_negocio, email, plan, precio_mensual, activo, alta_at')
    .order('alta_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Clientes</h1>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">€/mes</th>
              <th className="px-4 py-3 font-medium">Activo</th>
              <th className="px-4 py-3 font-medium">Marca</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(clientes ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                  Sin clientes todavía.
                </td>
              </tr>
            )}
            {(clientes ?? []).map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 text-zinc-900">{c.nombre_negocio}</td>
                <td className="px-4 py-2 text-zinc-600">{c.email}</td>
                <td className="px-4 py-2 text-zinc-600">{c.plan}</td>
                <td className="px-4 py-2 text-zinc-600">{c.precio_mensual ?? '—'}</td>
                <td className="px-4 py-2 text-zinc-600">{c.activo ? 'sí' : 'no'}</td>
                <td className="px-4 py-2 text-zinc-600">{c.marca}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
