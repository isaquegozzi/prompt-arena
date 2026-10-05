'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PromptEditor, type PromptEditorState } from '@/components/playground/prompt-editor';
import { ModelSelector } from '@/components/playground/model-selector';
import { ParametersPanel } from '@/components/playground/parameters-panel';
import { ResultGrid } from '@/components/results/result-grid';
import type { RunResultItem, RunSummary } from '@/components/results/types';
import { useHistory } from '@/lib/hooks/use-history';
import { substituteVariables } from '@/lib/utils/template';
import type {
  GenerationParameters,
  ProviderModel,
} from '@/lib/providers/types';

const EMPTY_EDITOR: PromptEditorState = {
  title: '',
  systemPrompt: '',
  userPrompt: 'Crie uma descricao comercial para o produto {{produto}}.',
  variableValues: { produto: 'fones de ouvido bluetooth' },
};

const EMPTY_PARAMS: GenerationParameters = {
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1,
};

export default function PlaygroundPage() {
  const [editor, setEditor] = useState<PromptEditorState>(EMPTY_EDITOR);
  const [parameters, setParameters] = useState<GenerationParameters>(EMPTY_PARAMS);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResultItem[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addRun } = useHistory();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/models')
      .then((r) => r.json())
      .then((data: { models: ProviderModel[] }) => {
        if (!mounted) return;
        setModels(data.models ?? []);
        // Pré-seleciona 3 modelos para facilitar o primeiro teste
        setSelected((data.models ?? []).slice(0, 3).map((m) => m.id));
      })
      .catch(() => {
        if (!mounted) setError('Falha ao carregar modelos.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedModels = useMemo(
    () => models.filter((m) => selected.includes(m.id)),
    [models, selected],
  );

  const toggle = useCallback(
    (id: string) =>
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  );
  const toggleAll = useCallback(
    (ids: string[]) =>
      setSelected((prev) =>
        prev.length === ids.length ? [] : ids,
      ),
    [],
  );

  const finalPrompt = useMemo(
    () => substituteVariables(editor.userPrompt, editor.variableValues),
    [editor.userPrompt, editor.variableValues],
  );
  const finalSystem = useMemo(
    () => substituteVariables(editor.systemPrompt, editor.variableValues),
    [editor.systemPrompt, editor.variableValues],
  );

  const canRun =
    !running &&
    editor.userPrompt.trim().length > 0 &&
    selectedModels.length > 0 &&
    finalPrompt.missing.length === 0;

  const run = useCallback(async () => {
    if (!canRun) return;
    setRunning(true);
    setError(null);
    setResults([]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: finalSystem.result || undefined,
          userPrompt: finalPrompt.result,
          parameters,
          models: selectedModels.map((m) => ({
            id: m.id,
            providerId: m.providerId,
            technicalId: m.technicalId,
            displayName: m.displayName,
            maxContext: m.maxContext,
            inputPricePer1M: m.inputPricePer1M,
            outputPricePer1M: m.outputPricePer1M,
            currency: m.currency,
            isLocal: m.isLocal,
            active: m.active,
            supportsStreaming: m.supportsStreaming,
          })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody?.error ?? `HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as {
        runId: string;
        items: Array<Record<string, unknown>>;
      };
      setRunId(data.runId);

      const items: RunResultItem[] = data.items.map((raw, idx) => ({
        id: `${data.runId}-${idx}`,
        runId: data.runId,
        promptTitle: editor.title || 'Prompt sem titulo',
        systemPrompt: finalSystem.result || undefined,
        finalPrompt: finalPrompt.result,
        parameters: parameters as Record<string, unknown>,
        modelTechnicalId: String(raw.modelTechnicalId ?? ''),
        modelName: String(raw.modelName ?? ''),
        providerName: String(raw.providerName ?? ''),
        status: raw.status as RunResultItem['status'],
        content: raw.content as string | undefined,
        inputTokens: raw.inputTokens as number | undefined,
        outputTokens: raw.outputTokens as number | undefined,
        totalTokens: raw.totalTokens as number | undefined,
        latencyMs: raw.latencyMs as number | undefined,
        timeToFirstTokenMs: raw.timeToFirstTokenMs as number | undefined,
        estimatedCost: raw.estimatedCost as number | undefined,
        finishReason: raw.finishReason as string | undefined,
        errorCode: raw.errorCode as string | undefined,
        errorMessage: raw.errorMessage as string | undefined,
        errorProvider: raw.errorProvider as string | undefined,
        statusCode: raw.statusCode as number | undefined,
        retryable: raw.retryable as boolean | undefined,
        createdAt: new Date().toISOString(),
      }));

      setResults(items);
      const summary: RunSummary = {
        id: data.runId,
        title: editor.title || 'Prompt sem titulo',
        createdAt: new Date().toISOString(),
        items,
      };
      addRun(summary);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setError('Execucao cancelada.');
      } else {
        setError(e instanceof Error ? e.message : 'Erro desconhecido.');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [canRun, editor.title, finalPrompt, finalSystem, parameters, selectedModels, addRun]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (runId) {
      fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      }).catch(() => {});
    }
  }, [runId]);

  const rerun = useCallback(
    (item: RunResultItem) => {
      // Reusa o prompt final expandido do card clicado
      setEditor((prev) => ({
        ...prev,
        userPrompt: item.finalPrompt,
      }));
      void run();
    },
    [run],
  );

  const toggleFavorite = useCallback((id: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)),
    );
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Playground</CardTitle>
          <CardDescription>
            Escreva um prompt e execute em varios modelos em paralelo. Modo demo ativo: nenhuma
            credencial e necessaria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromptEditor
            state={editor}
            onChange={setEditor}
            onClear={() => setEditor({ ...EMPTY_EDITOR, variableValues: {} })}
            onSave={() => {
              // Save hook sera ligado na Etapa 5 com persistencia real
              window.alert('Salvamento sera habilitado na Etapa 5 (persistencia).');
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelos</CardTitle>
          <CardDescription>Selecione um ou mais modelos para comparar.</CardDescription>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">Carregando modelos...</p>
          ) : (
            <ModelSelector
              models={models}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parametros de geracao</CardTitle>
          <CardDescription>Ajuste os parametros enviados a todos os modelos.</CardDescription>
        </CardHeader>
        <CardContent>
          <ParametersPanel parameters={parameters} onChange={setParameters} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={run} disabled={!canRun}>
          {running ? 'Executando...' : 'Executar comparacao'}
        </Button>
        <Button variant="outline" onClick={cancel} disabled={!running}>
          Cancelar
        </Button>
        <span className="text-xs text-muted-foreground">
          {selectedModels.length} modelo(s) selecionado(s)
          {finalPrompt.missing.length > 0
            ? ` - faltam ${finalPrompt.missing.length} variavel(is)`
            : ''}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {running && results.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {selectedModels.map((m) => (
            <Card key={`loading-${m.id}`} aria-busy="true">
              <CardHeader>
                <p className="text-sm font-semibold">{m.displayName}</p>
                <p className="text-xs text-muted-foreground">Executando...</p>
              </CardHeader>
              <CardContent>
                <div className="h-32 animate-pulse rounded-md bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {results.length > 0 ? (
        <ResultGrid
          items={results}
          onRerun={rerun}
          onToggleFavorite={(id) => toggleFavorite(id)}
        />
      ) : null}

      {!running && results.length === 0 && !error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhuma execucao ainda. Escreva o prompt, selecione os modelos e clique em &ldquo;Executar
            comparacao&rdquo;.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}