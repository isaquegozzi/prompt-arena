import { registerAdapter, hasAdapter } from '@/lib/providers/registry';
import { demoAdapter } from './demo/adapter';
import { openaiAdapter } from './openai/adapter';
import { anthropicAdapter } from './anthropic/adapter';
import { geminiAdapter } from './gemini/adapter';
import { openaiCompatibleAdapter } from './openai-compatible/adapter';
import { ollamaAdapter } from './ollama/adapter';

let initialized = false;

export function ensureAdaptersRegistered(): void {
  if (initialized) return;
  if (!hasAdapter('DEMO')) registerAdapter(demoAdapter);
  if (!hasAdapter('OPENAI')) registerAdapter(openaiAdapter);
  if (!hasAdapter('ANTHROPIC')) registerAdapter(anthropicAdapter);
  if (!hasAdapter('GEMINI')) registerAdapter(geminiAdapter);
  if (!hasAdapter('OPENAI_COMPATIBLE')) registerAdapter(openaiCompatibleAdapter);
  if (!hasAdapter('OLLAMA')) registerAdapter(ollamaAdapter);
  initialized = true;
}

// Auto-registro em ambientes server-side
if (typeof window === 'undefined') {
  ensureAdaptersRegistered();
}