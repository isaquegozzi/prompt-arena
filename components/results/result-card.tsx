'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import {
  STATUS_LABEL,
  STATUS_TONE,
  type RunResultItem,
} from './types';

export interface ResultCardProps {
  item: RunResultItem;
  onRerun?: (item: RunResultItem) => void;
  onToggleFavorite?: (id: string) => void;
}

export function ResultCard({ item, onRerun, onToggleFavorite }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<null | 'text' | 'md'>(null);

  function copyText(kind: 'text' | 'md') {
    if (!item.content) return;
    const text =
      kind === 'md'
        ? `## Resposta de ${item.modelName}\n\n${item.content}\n\n_${item.providerName} - latencia: ${item.latencyMs}ms_`
        : item.content;
    navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  const ok = item.status === 'COMPLETED';
  const isFav = Boolean(item.favorite);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.modelName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.providerName} - {item.modelTechnicalId}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
              STATUS_TONE[item.status],
            )}
          >
            {STATUS_LABEL[item.status]}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {item.latencyMs !== undefined && <span>lat: {item.latencyMs}ms</span>}
          {item.inputTokens !== undefined && <span>in: {item.inputTokens}</span>}
          {item.outputTokens !== undefined && <span>out: {item.outputTokens}</span>}
          {item.totalTokens !== undefined && <span>total: {item.totalTokens}</span>}
          {item.estimatedCost !== undefined && (
            <span>custo: ${item.estimatedCost.toFixed(6)}</span>
          )}
          {item.timeToFirstTokenMs !== undefined && <span>ttft: {item.timeToFirstTokenMs}ms</span>}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {ok ? (
          <div className="flex-1">
            <pre
              className={cn(
                'whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs',
                expanded ? 'max-h-none' : 'max-h-64 overflow-hidden',
              )}
            >
              {item.content}
            </pre>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              {expanded ? 'Recolher' : 'Expandir'}
            </button>
          </div>
        ) : (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <p className="font-medium">{item.errorCode}</p>
            <p>{item.errorMessage}</p>
            {item.statusCode !== undefined && <p>HTTP {item.statusCode}</p>}
            {item.retryable && <p className="mt-1">Retryable.</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!ok}
            onClick={() => copyText('text')}
          >
            {copied === 'text' ? 'Copiado!' : 'Copiar'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!ok}
            onClick={() => copyText('md')}
          >
            {copied === 'md' ? 'Copiado!' : 'Markdown'}
          </Button>
          {onToggleFavorite ? (
            <Button
              size="sm"
              variant={isFav ? 'secondary' : 'ghost'}
              onClick={() => onToggleFavorite(item.id)}
              aria-pressed={isFav}
            >
              {isFav ? '★ Favorito' : '☆ Favoritar'}
            </Button>
          ) : null}
          {onRerun ? (
            <Button size="sm" variant="ghost" onClick={() => onRerun(item)}>
              Executar novamente
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}