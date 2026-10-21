import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../store/auth';
import { getTelegramStartParam, isInTelegramWebApp } from './useTelegramSDK';
import { safeSession } from '../utils/safeStorage';

export function paymentReturnPath(startParam: string | null): string | null {
  const match = startParam?.match(/^topup_result_([a-zA-Z0-9_-]+)$/);
  return match
    ? `/balance/top-up/result?method=${encodeURIComponent(match[1].toLowerCase())}`
    : null;
}

export function useMiniAppPaymentReturn() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  useEffect(() => {
    if (!isInTelegramWebApp() || isLoading) return;
    const startParam = getTelegramStartParam();
    const target = paymentReturnPath(startParam);
    if (!target) return;
    const key = `startapp-redirect:${startParam}`;
    if (safeSession.getItem(key) === '1') return;
    // Keep the pending return until authentication has completed.
    if (!isAuthenticated) {
      if (location.pathname !== '/tg')
        navigate(`/tg?redirect=${encodeURIComponent(target)}`, { replace: true });
      return;
    }
    safeSession.setItem(key, '1');
    if (`${location.pathname}${location.search}` !== target) navigate(target, { replace: true });
  }, [isAuthenticated, isLoading, location.pathname, location.search, navigate]);
}
