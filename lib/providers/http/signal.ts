import { errors } from '../errors/normalize';

/**
 * Combina um AbortSignal externo (do usuario) com um timeout interno do
 * adaptador. Quando qualquer um dispara, a operacao deve ser cancelada e o
 * erro normalizado apropriadamente.
 *
 * Retorna:
 *   - signal: AbortSignal combinado para passar em fetch/SDK
 *   - cleanup: funcao para limpar listeners e timer (chamar no finally)
 */
export interface CombinedSignal {
  signal: AbortSignal;
  cleanup: () => void;
}

export function combineTimeoutSignal(
  timeoutMs: number,
  external?: AbortSignal,
): CombinedSignal {
  const controller = new AbortController();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanups: Array<() => void> = [];

  function abort(reason: 'timeout' | 'external') {
    if (controller.signal.aborted) return;
    try {
      controller.abort(reason === 'timeout' ? new Error('TIMEOUT') : undefined);
    } catch {
      controller.abort();
    }
  }

  if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
    timer = setTimeout(() => abort('timeout'), timeoutMs);
  }

  if (external) {
    if (external.aborted) {
      abort('external');
    } else {
      external.addEventListener('abort', () => abort('external'), { once: true });
      cleanups.push(() => external.removeEventListener('abort', () => abort('external')));
    }
  }

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  };

  return { signal: controller.signal, cleanup };
}

/**
 * Promisify um monitor: rejeita com errors.timeout se o signal abortar por
 * timeout, errors.canceled se for por signal externo, antes de promise resolver.
 */
export function withAbortGuard<T>(
  promise: Promise<T>,
  combined: CombinedSignal,
  provider: string,
  model?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (combined.signal.aborted) {
      reject(reasonFromSignal(combined.signal, provider, model));
      return;
    }
    const onAbort = () => reject(reasonFromSignal(combined.signal, provider, model));
    combined.signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (val) => {
        combined.signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        combined.signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

function reasonFromSignal(signal: AbortSignal, provider: string, model?: string) {
  // Node armazena o motivo em signal.reason; no browser geralmente e undefined
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  const isTimeout =
    (reason instanceof Error && /timeout/i.test(reason.message)) ||
    (typeof reason === 'string' && /timeout/i.test(reason));
  return isTimeout
    ? errors.timeout(provider, model)
    : errors.canceled(provider, model);
}