import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../../utils/api-error';
import type { useRenewalExtras } from '../../hooks/useRenewalExtras';

export function RenewalExtras({ extras }: { extras: ReturnType<typeof useRenewalExtras> }) {
  const { t } = useTranslation();
  if (!extras.active) return null;
  return (
    <section
      className="my-4 space-y-3 rounded-xl border border-dark-700/50 p-4"
      aria-label={t('subscription.renewalExtras.title')}
    >
      {extras.isFetching ? (
        <p role="status">{t('subscription.renewalExtras.loading')}</p>
      ) : extras.isError ? (
        <div role="alert">
          <p>{getApiErrorMessage(extras.error, t('subscription.renewalExtras.error'))}</p>
          <button type="button" onClick={() => extras.refetch()} className="btn-secondary mt-2">
            {t('subscription.renewalExtras.retry')}
          </button>
        </div>
      ) : (
        extras.data && (
          <>
            {extras.data.extra_squads.length > 0 && (
              <>
                <h3 className="font-medium">{t('subscription.renewalExtras.servers')}</h3>
                {extras.data.extra_squads.map((item) => (
                  <label key={item.uuid} className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => extras.toggle(item.uuid)}
                    />
                    <span className="min-w-0 flex-1 break-words">{item.name}</span>
                    <span>{item.price_label}</span>
                  </label>
                ))}
              </>
            )}
            <p className="flex flex-wrap justify-between gap-2 font-semibold">
              <span>{t('subscription.renewalExtras.total')}</span>
              <span>{extras.data.final_total_label}</span>
            </p>
          </>
        )
      )}
    </section>
  );
}
