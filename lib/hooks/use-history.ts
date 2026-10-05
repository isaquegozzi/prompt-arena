'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RunSummary } from '@/components/results/types';

const STORAGE_KEY = 'prompt-arena-history';

function safeRead(): RunSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RunSummary[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function safeWrite(runs: RunSummary[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    // quota or serialization error - ignore for MVP
  }
}

export function useHistory() {
  const [runs, setRuns] = useState<RunSummary[]>([]);

  useEffect(() => {
    setRuns(safeRead());
  }, []);

  const addRun = useCallback((run: RunSummary) => {
    setRuns((prev) => {
      const next = [run, ...prev].slice(0, 100);
      safeWrite(next);
      return next;
    });
  }, []);

  const removeRun = useCallback((runId: string) => {
    setRuns((prev) => {
      const next = prev.filter((r) => r.id !== runId);
      safeWrite(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRuns([]);
    safeWrite([]);
  }, []);

  return { runs, addRun, removeRun, clear };
}