'use client';

import { useMemo } from 'react';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { extractVariables, substituteVariables } from '@/lib/utils/template';

export interface PromptEditorState {
  title: string;
  systemPrompt: string;
  userPrompt: string;
  variableValues: Record<string, string>;
}

export interface PromptEditorProps {
  state: PromptEditorState;
  onChange: (next: PromptEditorState) => void;
  onClear: () => void;
  onSave: () => void;
}

export function PromptEditor({ state, onChange, onClear, onSave }: PromptEditorProps) {
  const variables = useMemo(
    () => extractVariables(`${state.systemPrompt}\n${state.userPrompt}`),
    [state.systemPrompt, state.userPrompt],
  );

  // Sincroniza chaves de variaveis sempre que a lista muda
  const variableValues = useMemo(() => {
    const next: Record<string, string> = {};
    for (const name of variables) {
      next[name] = state.variableValues[name] ?? '';
    }
    return next;
  }, [variables, state.variableValues]);

  const substitution = useMemo(
    () => substituteVariables(state.userPrompt, variableValues),
    [state.userPrompt, variableValues],
  );
  const substitutionSystem = useMemo(
    () => substituteVariables(state.systemPrompt, variableValues),
    [state.systemPrompt, variableValues],
  );

  const missing = Array.from(
    new Set([...substitution.missing, ...substitutionSystem.missing]),
  );

  function patch(partial: Partial<PromptEditorState>) {
    onChange({ ...state, ...partial });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="prompt-title">Titulo do prompt</Label>
          <Input
            id="prompt-title"
            value={state.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Ex.: Resumo de texto"
            className="mt-1"
          />
        </div>
        <Button variant="outline" onClick={onClear}>
          Limpar
        </Button>
        <Button onClick={onSave} disabled={!state.userPrompt}>
          Salvar
        </Button>
      </div>

      <div>
        <Label htmlFor="system-prompt">System prompt (opcional)</Label>
        <Textarea
          id="system-prompt"
          value={state.systemPrompt}
          onChange={(e) => patch({ systemPrompt: e.target.value })}
          placeholder="Voce e um assistente..."
          className="mt-1 min-h-[100px]"
          rows={4}
        />
      </div>

      <div>
        <Label htmlFor="user-prompt">User prompt</Label>
        <Textarea
          id="user-prompt"
          value={state.userPrompt}
          onChange={(e) => patch({ userPrompt: e.target.value })}
          placeholder="Resuma o texto a seguir: {{texto}}"
          className="mt-1 min-h-[180px]"
          rows={8}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use <code className="rounded bg-muted px-1">{'{{nome}}'}</code> para variaveis.
        </p>
      </div>

      {variables.length > 0 ? (
        <div className="rounded-md border border-border p-3">
          <p className="mb-2 text-sm font-medium">Variaveis detectadas</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {variables.map((name) => (
              <div key={name}>
                <Label htmlFor={`var-${name}`}>{name}</Label>
                <Input
                  id={`var-${name}`}
                  value={variableValues[name] ?? ''}
                  onChange={(e) =>
                    patch({ variableValues: { ...variableValues, [name]: e.target.value } })
                  }
                  placeholder={`Valor para ${name}`}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {missing.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning"
        >
          Aviso: as seguintes variaveis estao sem valor: {missing.map((m) => `{{${m}}}`).join(', ')}.
          O placeholder sera mantido na saida.
        </div>
      ) : null}

      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Pre-visualizacao da substituicao</summary>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
          {substitutionSystem.result || substitution.result
            ? `${substitutionSystem.result}\n\n---\n\n${substitution.result}`
            : 'Preencha o prompt para pre-visualizar.'}
        </pre>
      </details>
    </div>
  );
}