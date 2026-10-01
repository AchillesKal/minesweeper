import type { Planner } from '../core/game';
import { type Plan, type PlanRequest, plan } from '../core/generate';
import PlannerWorker from './planner.worker?worker&inline';

interface Pending {
  readonly req: PlanRequest;
  readonly resolve: (p: Plan) => void;
}

/**
 * Board generation runs in a worker so a slow no-guess search never blocks input.
 * Falls back to the main thread when workers are unavailable or crash.
 */
export function createPlanner(): Planner {
  let worker: Worker | null;
  try {
    worker = new PlannerWorker();
  } catch {
    worker = null;
  }
  if (!worker) return async (req) => plan(req);

  let nextId = 0;
  const pending = new Map<number, Pending>();
  worker.onmessage = (e: MessageEvent<{ id: number; plan: Plan }>) => {
    pending.get(e.data.id)?.resolve(e.data.plan);
    pending.delete(e.data.id);
  };
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    for (const { req, resolve } of pending.values()) resolve(plan(req));
    pending.clear();
  };

  return (req) =>
    new Promise((resolve) => {
      if (!worker) return resolve(plan(req));
      const id = nextId++;
      pending.set(id, { req, resolve });
      worker.postMessage({ id, req });
    });
}
