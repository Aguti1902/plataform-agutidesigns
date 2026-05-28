import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Globe,
  FileText,
  Bot,
  Wallet,
  Settings,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/clientes', label: 'Clientes', icon: Briefcase },
  { href: '/webs', label: 'Webs', icon: Globe },
  { href: '/presupuestos', label: 'Presupuestos', icon: FileText },
  { href: '/agentes', label: 'Agentes', icon: Bot },
  { href: '/finanzas', label: 'Finanzas', icon: Wallet },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white">
      <div className="px-5 py-5">
        <div className="text-sm font-semibold text-zinc-900">Mission Control</div>
        <div className="text-xs text-zinc-500">agutidesigns + lokify</div>
      </div>
      <nav className="flex-1 px-2 pb-4">
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <Icon className="h-4 w-4 text-zinc-500" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-zinc-200 px-4 py-3 text-[10px] text-zinc-400">
        v0.1.0 · día 1
      </div>
    </aside>
  );
}
