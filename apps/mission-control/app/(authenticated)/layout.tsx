import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agents } = await supabase
    .from('agent_config')
    .select('agent_name, enabled')
    .order('agent_name');

  const enabledCount = agents?.filter((a) => a.enabled).length ?? 0;
  const totalCount = agents?.length ?? 0;

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          email={user?.email ?? '—'}
          agentsEnabled={enabledCount}
          agentsTotal={totalCount}
        />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
