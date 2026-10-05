import { describe, it, expect } from 'vitest';
import {
  registerAdapter,
  getAdapter,
  hasAdapter,
  listRegisteredAdapters,
} from '@/lib/providers/registry';
import { demoAdapter } from '@/providers/demo/adapter';
import type { AIProviderAdapter, AdapterType } from '@/lib/providers/types';

// Adapter fake para testar o "missing" sem depender dos reais (que agora sao
// registrados automaticamente pelo setup.ts)
const fakeUnknown = { adapterType: 'OLLAMA' as AdapterType } as unknown as AIProviderAdapter;
void fakeUnknown;

describe('provider registry', () => {
  it('has DEMO adapter registered (via setup)', () => {
    expect(hasAdapter('DEMO')).toBe(true);
  });

  it('returns the same adapter via getAdapter', () => {
    expect(getAdapter('DEMO')).toBe(demoAdapter);
  });

  it('lists all 6 registered adapters', () => {
    const registered = listRegisteredAdapters();
    expect(registered).toContain('OPENAI');
    expect(registered).toContain('ANTHROPIC');
    expect(registered).toContain('GEMINI');
    expect(registered).toContain('OPENAI_COMPATIBLE');
    expect(registered).toContain('OLLAMA');
    expect(registered).toContain('DEMO');
  });

  it('throws on completely unknown adapter type (not in our 6)', () => {
    // Simula cenario removendo e tentando obter
    expect(() =>
      getAdapter('UNKNOWN' as AdapterType)
    ).toThrow(/No adapter registered for type/);
  });
});