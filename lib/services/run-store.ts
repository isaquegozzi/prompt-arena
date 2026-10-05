/**
 * Em memoria por processo; mantem os AbortControllers das runs em andamento
 * para que possam ser canceladas por id.
 *
 * Limitacao: em ambientes serverless cada instancia teria seu proprio mapa.
 * Para o MVP local isto e suficiente.
 */

const controllers = new Map<string, AbortController>();

export function registerRun(runId: string, controller: AbortController): void {
  controllers.set(runId, controller);
}

export function unregisterRun(runId: string): void {
  controllers.delete(runId);
}

export function cancelRun(runId: string): boolean {
  const controller = controllers.get(runId);
  if (!controller) return false;
  controller.abort();
  controllers.delete(runId);
  return true;
}