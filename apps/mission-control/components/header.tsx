import { LogoutButton } from './logout-button';

interface Props {
  email: string;
  agentsEnabled: number;
  agentsTotal: number;
}

export function Header({ email, agentsEnabled, agentsTotal }: Props) {
  const allRunning = agentsEnabled === agentsTotal && agentsTotal > 0;
  const noneRunning = agentsEnabled === 0;
  const dotColor = noneRunning
    ? 'bg-red-500'
    : allRunning
      ? 'bg-emerald-500'
      : 'bg-amber-500';
  const label = noneRunning
    ? 'Todos los agentes apagados'
    : allRunning
      ? 'Todos los agentes activos'
      : `${agentsEnabled} de ${agentsTotal} agentes activos`;

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
        {label}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-zinc-600">{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
