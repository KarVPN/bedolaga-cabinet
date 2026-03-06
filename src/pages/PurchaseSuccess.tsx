import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { landingApi } from '../api/landings';
import { copyToClipboard } from '../utils/clipboard';
import { cn } from '../lib/utils';

const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes

// ============================================================
// Sub-components
// ============================================================

function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-dark-600 border-t-accent-500',
        className,
      )}
    />
  );
}

function PendingState() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <Spinner className="h-16 w-16 border-[3px]" />
      <div>
        <h1 className="text-xl font-bold text-dark-50">
          {t('landing.awaitingPayment', 'Awaiting payment')}
        </h1>
        <p className="mt-2 text-sm text-dark-400">{t('landing.awaitingPaymentDesc')}</p>
      </div>
    </motion.div>
  );
}

function SuccessState({
  subscriptionUrl,
  cryptoLink,
  contactValue,
  tariffName,
  periodDays,
  isGift,
}: {
  subscriptionUrl: string | null;
  cryptoLink: string | null;
  contactValue: string | null;
  tariffName: string | null;
  periodDays: number | null;
  isGift: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const url = subscriptionUrl ?? cryptoLink;
    if (!url) return;

    try {
      await copyToClipboard(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed silently
    }
  }, [subscriptionUrl, cryptoLink]);

  const displayUrl = subscriptionUrl ?? cryptoLink;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-success-500/10"
      >
        <motion.svg
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="h-10 w-10 text-success-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          />
        </motion.svg>
      </motion.div>

      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-dark-50">{t('landing.purchaseSuccess')}</h1>
        {tariffName && periodDays && (
          <p className="mt-1 text-sm text-dark-300">
            {tariffName} — {periodDays} {t('landing.daysAccess')}
          </p>
        )}
        {contactValue && (
          <p className="mt-2 text-sm text-dark-400">
            {isGift
              ? t('landing.giftSentTo', { contact: contactValue })
              : t('landing.keySentTo', { contact: contactValue })}
          </p>
        )}
      </div>

      {/* QR Code */}
      {displayUrl && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5">
            <QRCodeSVG
              value={displayUrl}
              size={200}
              level="M"
              includeMargin={false}
              className="h-[200px] w-[200px]"
            />
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
              copied
                ? 'bg-success-500/10 text-success-500'
                : 'bg-dark-800/50 text-dark-200 hover:bg-dark-700/50',
            )}
          >
            {copied ? (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {t('landing.copied', 'Copied!')}
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                  />
                </svg>
                {t('landing.copyLink', 'Copy link')}
              </>
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function FailedState() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error-500/10">
        <svg
          className="h-10 w-10 text-error-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-bold text-dark-50">{t('landing.purchaseFailed')}</h1>
        <p className="mt-2 text-sm text-dark-400">{t('landing.purchaseFailedDesc')}</p>
      </div>
    </motion.div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function PurchaseSuccess() {
  const { token } = useParams<{ token: string }>();
  const pollStart = useRef(Date.now());

  // Referrer-Policy: prevent leaking payment token via referer header
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const { data: status, isError } = useQuery({
    queryKey: ['purchase-status', token],
    queryFn: () => landingApi.getPurchaseStatus(token!),
    enabled: !!token,
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status;
      if (currentStatus === 'pending' || currentStatus === 'paid') {
        if (Date.now() - pollStart.current > MAX_POLL_MS) {
          return false;
        }
        return 3_000;
      }
      return false;
    },
    retry: 2,
  });

  const isSuccess = status?.status === 'delivered';
  const isFailed = status?.status === 'failed' || status?.status === 'expired';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-dark-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-dark-800/50 bg-dark-900/50 p-8">
        {isError ? (
          <FailedState />
        ) : isSuccess ? (
          <SuccessState
            subscriptionUrl={status.subscription_url}
            cryptoLink={status.subscription_crypto_link}
            contactValue={status.contact_value}
            tariffName={status.tariff_name}
            periodDays={status.period_days}
            isGift={status.is_gift}
          />
        ) : isFailed ? (
          <FailedState />
        ) : (
          <PendingState />
        )}
      </div>
    </div>
  );
}
