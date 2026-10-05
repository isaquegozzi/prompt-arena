'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useHistory } from '@/lib/hooks/use-history';
import { STATUS_LABEL, STATUS_TONE, type RunResultStatus } from '@/components/results/types';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  const { runs, clear, removeRun } = useHistory();
  const [filter, setFilter] = useState('');

  const filtered = runs.filter((r) =>
    r.title.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Historico (local)</CardTitle>
          <CardDescription>
            Execucoes desta sessao, armazenadas no seu navegador (`localStorage`).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por titulo..."
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              variant="outline"
              onClick={clear}
              disabled={runs.length === 0}
              title="Limpar todo o historico local"
            >
              Limpar
            </Button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma execucao registrada. Volte para o{' '}
              <Link href="/" className="text-primary underline-offset-2 hover:underline">
                Playground
              </Link>{' '}
              e execute uma comparacao.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Titulo</th>
                    <th className="py-2 pr-3 font-medium">Modelos</th>
                    <th className="py-2 pr-3 font-medium">Lat. media</th>
                    <th className="py-2 pr-3 font-medium">Custo total</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((run) => {
                    const items = run.items;
                    const finished = items.filter((i) => i.status === 'COMPLETED');
                    const avgLatency =
                      finished.length > 0
                        ? Math.round(
                            finished.reduce((sum, i) => sum + (i.latencyMs ?? 0), 0) /
                              finished.length,
                          )
                        : undefined;
                    const totalCost = finished.reduce(
                      (sum, i) => sum + (i.estimatedCost ?? 0),
                      0,
                    );
                    const statuses = Array.from(new Set(items.map((i) => i.status)));
                    return (
                      <tr key={run.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3">{run.title}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {items.map((i) => i.modelName).join(', ')}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {avgLatency !== undefined ? `${avgLatency}ms` : '-'}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {totalCost > 0 ? `$${totalCost.toFixed(6)}` : '-'}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {statuses.map((s) => (
                              <span
                                key={s}
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[11px]',
                                  STATUS_TONE[s as RunResultStatus],
                                )}
                              >
                                {STATUS_LABEL[s as RunResultStatus]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeRun(run.id)}
                            className="text-xs text-destructive underline-offset-2 hover:underline"
                          >
                            remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}