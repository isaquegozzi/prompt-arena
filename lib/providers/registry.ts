import type { AIProviderAdapter, AdapterType } from './types';

/**
 * Registro central de adaptadores. Adicionar provedores = criar pasta em
 * /providers/<name> e registrar aqui.
 */

const registry: Partial<Record<AdapterType, AIProviderAdapter>> = {};

export function registerAdapter(adapter: AIProviderAdapter): void {
  registry[adapter.adapterType] = adapter;
}

export function getAdapter(type: AdapterType): AIProviderAdapter {
  const adapter = registry[type];
  if (!adapter) {
    throw new Error(`No adapter registered for type: ${type}`);
  }
  return adapter;
}

export function hasAdapter(type: AdapterType): boolean {
  return Boolean(registry[type]);
}

export function listRegisteredAdapters(): AdapterType[] {
  return Object.keys(registry) as AdapterType[];
}