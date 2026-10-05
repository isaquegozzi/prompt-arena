/**
 * Vitest setup global - garante que os adaptadores estejam registrados
 * (equivalente ao ensureAdaptersRegistered invocado na rota server-side).
 */
import { ensureAdaptersRegistered } from '@/providers';

ensureAdaptersRegistered();