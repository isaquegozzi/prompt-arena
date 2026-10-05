'use client';

import { ResultCard, type ResultCardProps } from './result-card';
import type { RunResultItem } from './types';

export interface ResultGridProps {
  items: RunResultItem[];
  onRerun?: (item: RunResultItem) => void;
  onToggleFavorite?: (id: string, runId: string) => void;
}

export function ResultGrid({ items, onRerun, onToggleFavorite }: ResultGridProps) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ResultCard
          key={item.id}
          item={item}
          onRerun={onRerun}
          onToggleFavorite={
            onToggleFavorite ? () => onToggleFavorite(item.id, item.runId) : undefined
          }
        />
      ))}
    </div>
  );
}

export type { RunResultItem, ResultCardProps };