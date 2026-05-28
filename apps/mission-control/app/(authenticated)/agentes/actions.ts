'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function toggleAgent(agentName: string, enabled: boolean) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('agent_config')
    .update({ enabled })
    .eq('agent_name', agentName);

  if (error) {
    throw new Error(`No se pudo actualizar ${agentName}: ${error.message}`);
  }

  revalidatePath('/agentes');
  revalidatePath('/', 'layout');
}
