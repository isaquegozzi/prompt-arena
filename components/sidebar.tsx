'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

type NavItem = {
  href: string;
  label: string;
  description: string;
  iconPath: string;
};

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Playground',
    description: 'Editor de prompts e comparacao',
    iconPath: 'M5 4h14M5 12h14M5 20h14',
  },
  {
    href: '/history',
    label: 'Historico',
    description: 'Execucoes anteriores',
    iconPath: 'M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/prompts',
    label: 'Prompts',
    description: 'Biblioteca de prompts',
    iconPath: 'M4 5h16M4 5l2 14h12l2-14M9 9v6M15 9v6',
  },
  {
    href: '/models',
    label: 'Modelos',
    description: 'Modelos cadastrados',
    iconPath: 'M4 6h16M4 12h16M4 18h7',
  },
  {
    href: '/providers',
    label: 'Provedores',
    description: 'Configuracao de provedores',
    iconPath: 'M5 7h14M5 12h14M5 17h14',
  },
  {
    href: '/settings',
    label: 'Configuracoes',
    description: 'Preferencias',
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.894.821 1.724 1.724 0 012.438 2.438 1.724 1.724 0 00.821 2.894c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-.821 2.894 1.724 1.724 0 01-2.438 2.438 1.724 1.724 0 00-2.894.821c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.894-.821 1.724 1.724 0 01-2.438-2.438 1.724 1.724 0 00-.821-2.894c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 00.821-2.894 1.724 1.724 0 012.438-2.438c.833.16 1.895-.058 2.894-.821z',
  },
  {
    href: '/about',
    label: 'Sobre',
    description: 'Sobre o projeto',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand font-bold text-brand-foreground">
          PA
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Prompt Arena</p>
          <p className="text-[11px] text-muted-foreground">v0.1.0</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  title={item.description}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-secondary font-medium text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}