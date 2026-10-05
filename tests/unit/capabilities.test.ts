import { describe, it, expect } from 'vitest';
import { CAPABILITIES, getCapabilities, filterParameters } from '@/lib/providers/capabilities/capabilities';
import type { GenerationParameters } from '@/lib/providers/types';

describe('capabilities catalog', () => {
  it('has capabilities for every adapter type', () => {
    const adps = ['OPENAI', 'ANTHROPIC', 'GEMINI', 'OPENAI_COMPATIBLE', 'OLLAMA', 'DEMO'] as const;
    for (const a of adps) expect(CAPABILITIES[a]).toBeDefined();
  });

  it('OPENAI supports all 8 parameters', () => {
    expect(CAPABILITIES.OPENAI.supportedParameters.size).toBe(8);
  });

  it('ANTHROPIC does not support seed or responseFormat', () => {
    const caps = getCapabilities('ANTHROPIC');
    expect(caps.supportedParameters.has('seed')).toBe(false);
    expect(caps.supportedParameters.has('responseFormat')).toBe(false);
  });

  it('OLLAMA supports seed but not responseFormat', () => {
    const caps = getCapabilities('OLLAMA');
    expect(caps.supportedParameters.has('seed')).toBe(true);
    expect(caps.supportedParameters.has('responseFormat')).toBe(false);
  });

  it('OPENAI_COMPATIBLE has supportsModelListing = false', () => {
    expect(CAPABILITIES.OPENAI_COMPATIBLE.supportsModelListing).toBe(false);
  });

  it('DEMO reports token usage and supports model listing', () => {
    expect(CAPABILITIES.DEMO.reportsTokenUsage).toBe(true);
    expect(CAPABILITIES.DEMO.supportsModelListing).toBe(true);
  });
});

describe('filterParameters', () => {
  it('keeps supported and ignores unsupported for ANTHROPIC', () => {
    const params: GenerationParameters = {
      temperature: 0.5,
      seed: 42,
      responseFormat: 'json',
      maxTokens: 100,
      stop: ['END'],
    };
    const { allowed, ignored } = filterParameters('ANTHROPIC', params);
    expect(allowed.temperature).toBe(0.5);
    expect(allowed.maxTokens).toBe(100);
    expect(allowed.stop).toEqual(['END']);
    expect(allowed.seed).toBeUndefined();
    expect(allowed.responseFormat).toBeUndefined();
    expect(ignored).toContain('seed');
    expect(ignored).toContain('responseFormat');
  });

  it('preserves all parameters for OPENAI', () => {
    const params: GenerationParameters = {
      temperature: 1,
      maxTokens: 10,
      topP: 0.9,
      seed: 1,
      responseFormat: 'text',
    };
    const { allowed, ignored } = filterParameters('OPENAI', params);
    expect(ignored).toEqual([]);
    expect(allowed).toEqual(params);
  });

  it('ignores undefined parameters cleanly', () => {
    const { allowed, ignored } = filterParameters('ANTHROPIC', {
      maxTokens: 50,
    });
    expect(allowed.maxTokens).toBe(50);
    expect(ignored).toEqual([]);
  });
});