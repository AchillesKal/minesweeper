/// <reference lib="webworker" />
import { type PlanRequest, plan } from '../core/generate';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<{ id: number; req: PlanRequest }>) => {
  const { id, req } = e.data;
  self.postMessage({ id, plan: plan(req) });
};
