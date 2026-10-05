'use client';

import { useTheme } from '@/components/theme-provider';

const options: Array<{ label: string; value: 'light' | 'dark' | 'system' }> = [
  { label: 'Claro', value: 'light' },
  { label: 'Escuro', value: 'dark' },
  { label: 'Sistema', value: 'system' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <select
      aria-label="Alternar tema"
      value={theme}
      onChange={(e) => setTheme(e.target.value as typeof theme)}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}