import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { API_BASE_URL } from '@/lib/http';

// Simple connectivity hook that pings the backend /health endpoint on an interval
// Falls back to navigator.onLine (web) when available. Designed for Expo/React Native.
export function useConnectivity(options?: { intervalMs?: number; timeoutMs?: number }) {
  const intervalMs = options?.intervalMs ?? 15000;
  const timeoutMs = options?.timeoutMs ?? 6000;

  const [online, setOnline] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<number>(Date.now());
  const [checking, setChecking] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  async function ping() {
    // If running on web and navigator.onLine is available, prefer it for quick signal
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      if (navigator.onLine === false) {
        setOnline(false);
        setLastChecked(Date.now());
        return;
      }
    }

    setChecking(true);
    setLastChecked(Date.now());
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }).catch((e) => {
        // Normalize network/abort errors
        throw e;
      }).finally(() => clearTimeout(t));

      if (res && res.ok) {
        setOnline(true);
      } else {
        setOnline(false);
      }
    } catch {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    // Initial ping
    ping();

    // Re-ping on app foreground
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        void ping();
      }
    });

    // Interval
    timerRef.current = setInterval(ping, intervalMs);

    return () => {
      sub.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMs, timeoutMs]);

  return { online, checking, lastChecked, ping } as const;
}
