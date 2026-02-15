'use client';

import { useEffect, useState } from 'react';

type HealthPayload = {
  ok: boolean;
  timestamp: string;
};

export function HealthStatus() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        setIsLoading(true);
        setIsError(false);

        const res = await fetch('/api/health', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`health http ${res.status}`);
        }

        const json = (await res.json()) as HealthPayload;
        if (!cancelled) {
          setData(json);
        }
      } catch {
        if (!cancelled) {
          setIsError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();
    const interval = setInterval(run, 15_000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return <span className="text-xs text-slate-400">API: checking…</span>;
  }

  if (isError || !data?.ok) {
    return <span className="text-xs text-rose-400">API: offline</span>;
  }

  return (
    <span className="text-xs text-emerald-400">
      API: online · {new Date(data.timestamp).toLocaleTimeString()}
    </span>
  );
}
