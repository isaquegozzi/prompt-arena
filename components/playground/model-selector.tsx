'use client';

import { cn } from '@/lib/utils/cn';
import type { ProviderModel } from '@/lib/providers/types';

export interface ModelSelectorProps {
  models: ProviderModel[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
}

export function ModelSelector({ models, selected, onToggle, onToggleAll }: ModelSelectorProps) {
  const allSelected = models.length > 0 && models.every((m) => selected.includes(m.id));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Selecione os modelos ({selected.length}/{models.length})</p>
        <button
          type="button"
          onClick={() => onToggleAll(models.map((m) => m.id))}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {allSelected ? 'Limpar selecao' : 'Selecionar todos'}
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {models.map((m) => {
          const isOn = selected.includes(m.id);
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={isOn}
                onClick={() => onToggle(m.id)}
                title={m.technicalId}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left transition-colors',
                  isOn
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-secondary/60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{m.displayName}</span>
                  <input
                    type="checkbox"
                    checked={isOn}
                    readOnly
                    aria-hidden
                    className="h-3.5 w-3.5"
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {m.isLocal ? (
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-success">local</span>
                  ) : (
                    <span className="rounded bg-muted px-1.5 py-0.5">remoto</span>
                  )}
                  {m.maxContext ? <span>ctx: {formatNumber(m.maxContext)}</span> : null}
                  {m.supportsStreaming ? <span>stream</span> : null}
                  {m.inputPricePer1M !== undefined && m.inputPricePer1M > 0 ? (
                    <span>${m.inputPricePer1M}/1M in</span>
                  ) : null}
                  {m.outputPricePer1M !== undefined && m.outputPricePer1M > 0 ? (
                    <span>${m.outputPricePer1M}/1M out</span>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}k`;
  return String(n);
}