import { useEffect, useState } from 'react';
import { requestApi } from '../lib/api';

export function useMeetingResource<T>(path: string, enabled: boolean, revision?: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  const key = JSON.stringify([path, revision, attempt]);
  const settledKey = result?.key;

  useEffect(() => {
    if (!enabled || settledKey === key) return;
    const controller = new AbortController();
    requestApi<T>(path, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, data }); },
      (error: Error) => {
        if (!controller.signal.aborted) setResult({ key, error: error.message || 'Could not load this content.' });
      },
    );
    return () => controller.abort();
  }, [enabled, key, path, settledKey]);

  return {
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
    retry: () => setAttempt((current) => current + 1),
  };
}
