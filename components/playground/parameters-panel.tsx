'use client';

import { Input, Label } from '@/components/ui/input';
import type { GenerationParameters } from '@/lib/providers/types';

export interface ParametersPanelProps {
  parameters: GenerationParameters;
  onChange: (next: GenerationParameters) => void;
}

const fields: Array<{
  key: keyof GenerationParameters;
  label: string;
  type: 'number' | 'text';
  step?: number;
  min?: number;
  max?: number;
}> = [
  { key: 'temperature', label: 'temperature', type: 'number', step: 0.1, min: 0, max: 2 },
  { key: 'maxTokens', label: 'max tokens', type: 'number', step: 1, min: 1, max: 1_000_000 },
  { key: 'topP', label: 'top_p', type: 'number', step: 0.01, min: 0, max: 1 },
  {
    key: 'frequencyPenalty',
    label: 'frequency penalty',
    type: 'number',
    step: 0.1,
    min: -2,
    max: 2,
  },
  {
    key: 'presencePenalty',
    label: 'presence penalty',
    type: 'number',
    step: 0.1,
    min: -2,
    max: 2,
  },
  { key: 'seed', label: 'seed', type: 'number', step: 1, min: 0 },
];

export function ParametersPanel({ parameters, onChange }: ParametersPanelProps) {
  function patch<K extends keyof GenerationParameters>(key: K, value: GenerationParameters[K]) {
    onChange({ ...parameters, [key]: value });
  }

  function parseNumber(value: string): number | undefined {
    if (value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {fields.map((f) => (
        <div key={f.key}>
          <Label htmlFor={`param-${f.key}`}>{f.label}</Label>
          <Input
            id={`param-${f.key}`}
            type={f.type}
            inputMode="decimal"
            step={f.step}
            min={f.min}
            max={f.max}
            value={parameters[f.key] === undefined ? '' : String(parameters[f.key])}
            onChange={(e) => patch(f.key, parseNumber(e.target.value) as never)}
            className="mt-1"
          />
        </div>
      ))}
      <div>
        <Label htmlFor="param-responseFormat">response format</Label>
        <select
          id="param-responseFormat"
          value={parameters.responseFormat ?? 'text'}
          onChange={(e) =>
            patch('responseFormat', e.target.value === 'json' ? 'json' : 'text')
          }
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="text">text</option>
          <option value="json">json</option>
        </select>
      </div>
      <p className="col-span-2 text-xs text-muted-foreground md:col-span-3">
        Nem todos os provedores suportam todos os parametros; os incompativeis sao ignorados com
        seguranca pela camada do adaptador.
      </p>
    </div>
  );
}