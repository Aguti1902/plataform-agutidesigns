import { KpiCard } from '@/components/kpi-card';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const [{ count: clientesActivos }, { count: leadsNuevos }, { count: webs }] = await Promise.all([
    supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'nuevo'),
    supabase.from('webs').select('*', { count: 'exact', head: true }).eq('status', 'vivo'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          Resumen general — los KPIs reales se conectarán a medida que los agentes generen datos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="MRR" value="0 €" hint="Cargado por dashboard-financiero" />
        <KpiCard
          label="Clientes activos"
          value={String(clientesActivos ?? 0)}
          hint="Suscripciones vivas"
        />
        <KpiCard label="Churn 30d" value="—" hint="Pendiente de calcular" />
        <KpiCard label="Margen bruto" value="—" hint="Ingresos − costes agentes" />
        <KpiCard label="Leads nuevos" value={String(leadsNuevos ?? 0)} hint="Sin contactar aún" />
        <KpiCard label="Webs en vivo" value={String(webs ?? 0)} hint="Servidas desde Vercel" />
        <KpiCard label="Tickets pendientes" value="—" hint="Soporte sin responder" />
        <KpiCard label="Coste IA hoy" value="—" hint="Agregado de agent_runs" />
      </div>
    </div>
  );
}
