/** localStorage that never throws (private mode, quota, sandboxed frames). */
export interface KV {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
}

export function createStorage(backend: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage()): KV {
  const prefix = 'ms2.';
  return {
    get(key, fallback) {
      try {
        const raw = backend?.getItem(prefix + key);
        return raw == null ? fallback : (JSON.parse(raw) as typeof fallback);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        backend?.setItem(prefix + key, JSON.stringify(value));
      } catch {
        /* storage full or blocked: progress just won't persist */
      }
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
