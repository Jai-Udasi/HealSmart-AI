import { useState, useEffect, useCallback } from 'react';

/**
 * Reusable hook for executing an async API call with loading and error states.
 *
 * @param {Function} apiFn - Async function returning API response
 * @param {Array} deps - Dependency array for automatic execution
 * @param {boolean} [immediate=true] - Whether to run immediately on mount
 */
export function useApiQuery(apiFn, deps = [], immediate = true) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFn(...args);
        setData(res.data ?? res);
        setMeta(res.meta ?? null);
        return res;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    if (immediate) {
      execute().catch(() => {});
    }
  }, [execute, immediate]);

  return { data, meta, loading, error, refetch: execute };
}
