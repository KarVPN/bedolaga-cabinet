import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { authApi } from '../api/auth';
import { useToast } from '../components/Toast';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import ProviderIcon from '../components/ProviderIcon';
import { LINK_OAUTH_STATE_KEY, LINK_OAUTH_PROVIDER_KEY } from './LinkOAuthCallback';
import { getTelegramInitData } from '../hooks/useTelegramSDK';
import { usePlatform, useIsTelegram } from '@/platform/hooks/usePlatform';
import type { LinkedProvider } from '../types';

const OAUTH_PROVIDERS = ['google', 'yandex', 'discord', 'vk'];

const isOAuthProvider = (provider: string): boolean => OAUTH_PROVIDERS.includes(provider);

const isLinkableProvider = (provider: string): boolean =>
  isOAuthProvider(provider) || provider === 'telegram';

// SessionStorage key for Telegram link CSRF state
export const LINK_TELEGRAM_STATE_KEY = 'link_telegram_state';

/** Compact Telegram Login Widget for account linking (browser only). */
function TelegramLinkWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';

  useEffect(() => {
    if (!containerRef.current || !botUsername) return;

    const container = containerRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Generate CSRF state token and store in sessionStorage
    const csrfState = crypto.randomUUID();
    sessionStorage.setItem(LINK_TELEGRAM_STATE_KEY, csrfState);

    const redirectUrl = `${window.location.origin}/auth/link/telegram/callback?csrf_state=${encodeURIComponent(csrfState)}`;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'small');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-auth-url', redirectUrl);
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    container.appendChild(script);

    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [botUsername]);

  if (!botUsername) {
    return null;
  }

  return <div ref={containerRef} className="flex items-center" />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <div className="flex animate-pulse items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-dark-700" />
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-dark-700" />
                <div className="h-3 w-32 rounded bg-dark-700" />
              </div>
            </div>
            <div className="h-8 w-20 rounded bg-dark-700" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function ConnectedAccounts() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [confirmingUnlink, setConfirmingUnlink] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [waitingExternalLink, setWaitingExternalLink] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const inTelegram = useIsTelegram();
  const platform = usePlatform();

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['linked-providers'],
    queryFn: () => authApi.getLinkedProviders(),
    refetchOnWindowFocus: true,
    // Poll every 5s while waiting for external browser OAuth to complete
    refetchInterval: waitingExternalLink ? 5000 : false,
  });

  // Stop polling after 90 seconds
  useEffect(() => {
    if (!waitingExternalLink) return;
    const timeout = setTimeout(() => setWaitingExternalLink(false), 90_000);
    return () => clearTimeout(timeout);
  }, [waitingExternalLink]);

  const unlinkMutation = useMutation({
    mutationFn: (provider: string) => authApi.unlinkProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
      showToast({
        type: 'success',
        message: t('profile.accounts.unlinkSuccess'),
      });
    },
    onError: () => {
      showToast({
        type: 'error',
        message: t('profile.accounts.unlinkError'),
      });
    },
    onSettled: () => {
      setConfirmingUnlink(null);
    },
  });

  const canUnlink = (provider: LinkedProvider): boolean => {
    if (!provider.linked) return false;
    if (!isOAuthProvider(provider.provider)) return false;
    const linkedCount = data?.providers.filter((p) => p.linked).length ?? 0;
    return linkedCount > 1;
  };

  const handleLinkOAuth = async (provider: string) => {
    if (linkingProvider) return;
    setLinkingProvider(provider);
    try {
      const { authorize_url, state } = await authApi.linkProviderInit(provider);

      if (inTelegram) {
        // Mini App: open in external browser to avoid WebView OAuth restrictions.
        // The callback will use server-complete flow (auth via state token, no JWT).
        platform.openLink(authorize_url);
        setLinkingProvider(null);
        // Start polling for linked providers (external browser has no way to notify Mini App)
        setWaitingExternalLink(true);
        showToast({
          type: 'info',
          message: t('profile.accounts.continueInBrowser'),
        });
      } else {
        // Regular browser: navigate within the same tab.
        // Save state in sessionStorage for the callback page to verify.
        sessionStorage.setItem(LINK_OAUTH_STATE_KEY, state);
        sessionStorage.setItem(LINK_OAUTH_PROVIDER_KEY, provider);
        window.location.href = authorize_url;
      }
    } catch {
      showToast({
        type: 'error',
        message: t('profile.accounts.linkError'),
      });
      setLinkingProvider(null);
    }
  };

  const handleLinkTelegram = async () => {
    if (linkingProvider) return;
    const initData = getTelegramInitData();
    if (!initData) return;

    setLinkingProvider('telegram');
    try {
      const response = await authApi.linkTelegram({ init_data: initData });
      if (response.merge_required && response.merge_token) {
        navigate(`/merge/${response.merge_token}`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
        showToast({ type: 'success', message: t('profile.accounts.linkSuccess') });
      }
    } catch {
      showToast({ type: 'error', message: t('profile.accounts.linkError') });
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleLink = async (provider: string) => {
    if (provider === 'telegram') {
      await handleLinkTelegram();
    } else {
      await handleLinkOAuth(provider);
    }
  };

  const handleUnlink = (provider: string) => {
    if (confirmingUnlink === provider) {
      setConfirmingUnlink(null);
      unlinkMutation.mutate(provider);
    } else {
      setConfirmingUnlink(provider);
    }
  };

  const renderLinkButton = (provider: LinkedProvider) => {
    if (provider.provider === 'telegram') {
      if (inTelegram && getTelegramInitData()) {
        // Mini App: one-click button
        return (
          <Button
            variant="primary"
            size="sm"
            disabled={linkingProvider !== null}
            loading={linkingProvider === 'telegram'}
            onClick={() => handleLink('telegram')}
          >
            {t('profile.accounts.link')}
          </Button>
        );
      }
      // Browser: Telegram Login Widget
      return <TelegramLinkWidget />;
    }

    if (isOAuthProvider(provider.provider)) {
      return (
        <Button
          variant="primary"
          size="sm"
          disabled={linkingProvider !== null}
          loading={linkingProvider === provider.provider}
          onClick={() => handleLink(provider.provider)}
        >
          {t('profile.accounts.link')}
        </Button>
      );
    }

    return null;
  };

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Page title */}
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">
          {t('profile.accounts.title')}
        </h1>
        <p className="mt-1 text-dark-400">{t('profile.accounts.subtitle')}</p>
      </motion.div>

      {/* Loading state */}
      {isLoading && (
        <motion.div variants={staggerItem}>
          <LoadingSkeleton />
        </motion.div>
      )}

      {/* Error state */}
      {isError && (
        <motion.div variants={staggerItem}>
          <Card>
            <p className="text-center text-dark-400">{t('common.error')}</p>
          </Card>
        </motion.div>
      )}

      {/* Provider cards */}
      {data?.providers.map((provider) => (
        <motion.div key={provider.provider} variants={staggerItem}>
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ProviderIcon provider={provider.provider} />
                <div>
                  <p className="font-medium text-dark-100">
                    {t(`profile.accounts.providers.${provider.provider}`)}
                  </p>
                  {provider.identifier && (
                    <p className="text-sm text-dark-400">{provider.identifier}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {provider.linked ? (
                  <>
                    <span className="text-sm text-success-500">{t('profile.accounts.linked')}</span>
                    {canUnlink(provider) && (
                      <Button
                        variant={confirmingUnlink === provider.provider ? 'destructive' : 'outline'}
                        size="sm"
                        disabled={unlinkMutation.isPending}
                        loading={
                          unlinkMutation.isPending && unlinkMutation.variables === provider.provider
                        }
                        onClick={() => handleUnlink(provider.provider)}
                        onBlur={() => {
                          blurTimeoutRef.current = setTimeout(() => {
                            setConfirmingUnlink((cur) => (cur === provider.provider ? null : cur));
                          }, 150);
                        }}
                      >
                        {confirmingUnlink === provider.provider
                          ? t('profile.accounts.unlinkConfirmBtn')
                          : t('profile.accounts.unlink')}
                      </Button>
                    )}
                  </>
                ) : (
                  isLinkableProvider(provider.provider) && renderLinkButton(provider)
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
