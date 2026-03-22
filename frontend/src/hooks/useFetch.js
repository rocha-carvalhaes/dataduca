import { useState, useEffect, useCallback } from 'react';

export function useFetch(loaderFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await loaderFn();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loaderFn]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, loading, error, setError, refetch: load };
}
