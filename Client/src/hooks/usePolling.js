import { useEffect, useState } from "react";

export default function usePolling(url, interval = 2000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let timer;
    let controller;

    async function poll() {
      controller = new AbortController();

      try {
        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (active) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (active && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(poll, interval);
        }
      }
    }

    poll();

    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [url, interval]);

  return { data, loading, error };
}
