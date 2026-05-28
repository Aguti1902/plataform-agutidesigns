'use client';

import { useTransition, useState } from 'react';
import { Switch } from '@agutidesigns/ui';
import { toggleAgent } from './actions';

interface Props {
  agentName: string;
  enabled: boolean;
}

export function AgentToggle({ agentName, enabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: boolean) {
    setOptimistic(next);
    setError(null);
    startTransition(async () => {
      try {
        await toggleAgent(agentName, next);
      } catch (e) {
        setOptimistic(!next);
        setError(e instanceof Error ? e.message : 'Error desconocido');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={optimistic} disabled={isPending} onCheckedChange={handleChange} />
      <span className="text-xs text-zinc-500">{optimistic ? 'on' : 'off'}</span>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
