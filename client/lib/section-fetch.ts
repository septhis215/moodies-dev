type PendingSection = {
  controller: AbortController;
  promise: Promise<unknown>;
  subscribers: number;
  finished: boolean;
};

/** Public section GETs only: share pending work and cap active requests at three. */
export function createSectionFetcher() {
  const pending = new Map<string, PendingSection>();
  const queue: Array<() => void> = [];
  let active = 0;
  const drain = () => {
    while (active < 3 && queue.length) queue.shift()!();
  };

  return function fetchSectionJson(url: string, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    let entry = pending.get(url);
    if (!entry || entry.controller.signal.aborted) {
      let resolve!: (value: unknown) => void;
      let reject!: (error: unknown) => void;
      entry = {
        controller: new AbortController(), subscribers: 0, finished: false,
        promise: new Promise((yes, no) => { resolve = yes; reject = no; }),
      };
      const current = entry;
      pending.set(url, current);
      queue.push(() => {
        if (current.controller.signal.aborted) {
          current.finished = true;
          reject(current.controller.signal.reason);
          if (pending.get(url) === current) pending.delete(url);
          return;
        }
        active++;
        void (async () => {
          try {
            const response = await fetch(url, {
              credentials: "omit", cache: "no-store",
              signal: AbortSignal.any([current.controller.signal, AbortSignal.timeout(30_000)]),
            });
            if (!response.ok) throw new Error(`Section request failed: HTTP ${response.status}`);
            const data: unknown = await response.json();
            current.finished = true;
            resolve(data);
          } catch (error) {
            current.finished = true;
            reject(error);
          } finally {
            active--;
            if (pending.get(url) === current) pending.delete(url);
            drain();
          }
        })();
      });
    }
    const current = entry;
    return new Promise((resolve, reject) => {
      let subscribed = true;
      current.subscribers++;
      const release = () => {
        subscribed = false;
        signal?.removeEventListener("abort", cancel);
        current.subscribers--;
        if (!current.subscribers && !current.finished) current.controller.abort();
      };
      const cancel = () => { release(); reject(signal?.reason); };
      current.promise.then(data => {
        if (subscribed) { release(); resolve(data); }
      }, error => {
        if (subscribed) { release(); reject(error); }
      });
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) cancel();
      drain();
    });
  };
}

export const fetchSectionJson = createSectionFetcher();
