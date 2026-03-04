import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { authApi } from '../api/auth';
import { LINK_OAUTH_STATE_KEY, LINK_OAUTH_PROVIDER_KEY } from './LinkOAuthCallback';

// SessionStorage helpers for OAuth LOGIN state
const OAUTH_STATE_KEY = 'oauth_state';
const OAUTH_PROVIDER_KEY = 'oauth_provider';

export function saveOAuthState(state: string, provider: string): void {
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider);
}

export function getAndClearOAuthState(): { state: string; provider: string } | null {
  const state = sessionStorage.getItem(OAUTH_STATE_KEY);
  const provider = sessionStorage.getItem(OAUTH_PROVIDER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
  if (!state || !provider) return null;
  return { state, provider };
}

/** Read link OAuth state without clearing (cleared only after successful match). */
function peekLinkOAuthState(): { state: string; provider: string } | null {
  const state = sessionStorage.getItem(LINK_OAUTH_STATE_KEY);
  const provider = sessionStorage.getItem(LINK_OAUTH_PROVIDER_KEY);
  if (!state || !provider) return null;
  return { state, provider };
}

function clearLinkOAuthState(): void {
  sessionStorage.removeItem(LINK_OAUTH_STATE_KEY);
  sessionStorage.removeItem(LINK_OAUTH_PROVIDER_KEY);
}

type CallbackMode = 'login' | 'link-browser' | 'link-server';

/** Result after successful server-complete linking from external browser. */
interface ServerLinkResult {
  success: boolean;
  merge_required: boolean;
  merge_token: string | null;
  provider?: string;
}

export default function OAuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [serverLinkResult, setServerLinkResult] = useState<ServerLinkResult | null>(null);
  const loginWithOAuth = useAuthStore((state) => state.loginWithOAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double-fire from React StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get('code');
    const urlState = searchParams.get('state');
    const deviceId = searchParams.get('device_id');

    if (!code || !urlState) {
      setError(t('auth.oauthError', 'Authorization was denied or failed'));
      return;
    }

    // Determine callback mode:
    // 1. Link state in sessionStorage → browser linking flow
    // 2. Login state in sessionStorage → login flow
    // 3. Neither → opened from external browser (Mini App flow) → server-complete
    let mode: CallbackMode = 'link-server';
    let savedProvider: string | null = null;
    let savedState: string | null = null;

    const linkSaved = peekLinkOAuthState();
    if (linkSaved && linkSaved.state === urlState) {
      clearLinkOAuthState();
      mode = 'link-browser';
      savedProvider = linkSaved.provider;
      savedState = linkSaved.state;
    } else {
      const loginSaved = getAndClearOAuthState();
      if (loginSaved && loginSaved.state === urlState) {
        mode = 'login';
        savedProvider = loginSaved.provider;
        savedState = loginSaved.state;
      }
    }

    const handle = async () => {
      if (mode === 'link-browser') {
        // Browser linking: user is authenticated, complete via JWT-protected endpoint
        try {
          const response = await authApi.linkProviderCallback(
            savedProvider!,
            code,
            savedState!,
            deviceId ?? undefined,
          );
          if (response.merge_required && response.merge_token) {
            navigate(`/merge/${response.merge_token}`, { replace: true });
          } else {
            navigate('/profile/accounts', { replace: true });
          }
        } catch {
          setError(t('profile.accounts.linkError'));
        }
        return;
      }

      if (mode === 'login') {
        // Login flow
        if (isAuthenticated) {
          navigate('/', { replace: true });
          return;
        }
        try {
          await loginWithOAuth(savedProvider!, code, savedState!, deviceId);
          navigate('/', { replace: true });
        } catch (err: unknown) {
          const detail =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            (err instanceof Error ? err.message : null);
          setError(detail || t('auth.oauthError', 'Authorization was denied or failed'));
        }
        return;
      }

      // mode === 'link-server': No sessionStorage state found.
      // This happens when OAuth was opened in external browser from Mini App.
      // Complete linking via state-token-authenticated server endpoint.
      // Clear sensitive data from URL immediately.
      window.history.replaceState({}, '', '/auth/oauth/callback');

      try {
        // Provider is resolved server-side from the state token in Redis.
        const response = await authApi.linkServerComplete(code, urlState, deviceId ?? undefined);

        setServerLinkResult(response);
      } catch {
        setError(t('profile.accounts.linkError'));
      }
    };

    handle();
  }, [searchParams, loginWithOAuth, navigate, isAuthenticated, t]);

  // Server-complete result: show success/error with "Return to Telegram" link
  if (serverLinkResult) {
    if (serverLinkResult.merge_required && serverLinkResult.merge_token) {
      // Redirect to merge page (public, works without JWT)
      navigate(`/merge/${serverLinkResult.merge_token}`, { replace: true });
      return null;
    }

    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';
    const telegramLink = botUsername ? `https://t.me/${botUsername}` : '';

    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
        <div className="relative w-full max-w-md text-center">
          <div className="card">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success-500/20">
              <svg
                className="h-8 w-8 text-success-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-dark-50">
              {t('profile.accounts.linkSuccess')}
            </h2>
            <p className="mb-6 text-sm text-dark-400">{t('profile.accounts.returnToTelegram')}</p>
            {telegramLink && (
              <a
                href={telegramLink}
                className="btn-primary inline-block w-full rounded-lg bg-accent-500 px-6 py-3 text-center font-medium text-dark-950 no-underline transition-colors hover:bg-accent-400"
              >
                {t('profile.accounts.openTelegram')}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
        <div className="relative w-full max-w-md text-center">
          <div className="card">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/20">
              <svg
                className="h-8 w-8 text-error-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-dark-50">{t('auth.loginFailed')}</h2>
            <p className="mb-6 text-sm text-dark-400">{error}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="btn-primary w-full"
            >
              {t('auth.backToLogin', 'Back to login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
      <div className="relative text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        <h2 className="text-lg font-semibold text-dark-50">{t('auth.authenticating')}</h2>
        <p className="mt-2 text-sm text-dark-400">{t('common.loading')}</p>
      </div>
    </div>
  );
}
