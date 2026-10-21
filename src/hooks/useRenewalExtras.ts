import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '../api/subscription';

/** Quote the exact subscription; the server remains the source of the payable total. */
export function useRenewalExtras(
  tariffId: number | undefined,
  subscriptionId: number | undefined,
  days: number | null,
  trafficGb?: number,
  enabled = true,
) {
  const context = `${tariffId}:${subscriptionId}`;
  const [selection, setSelection] = useState<{ context: string; values: string[] } | null>(null);
  const selected = selection?.context === context ? selection.values : undefined;
  const active = enabled && !!tariffId && !!days;
  const quote = useQuery({
    queryKey: ['tariff-renewal-preview', subscriptionId, tariffId, days, trafficGb, selected],
    queryFn: () =>
      subscriptionApi.previewTariffRenewal(tariffId!, days!, trafficGb, selected, subscriptionId),
    enabled: active,
    retry: false,
  });
  const toggle = (uuid: string) =>
    setSelection((current) => {
      const values =
        (current?.context === context ? current.values : undefined) ??
        quote.data?.extra_squads.filter((item) => item.enabled).map((item) => item.uuid) ??
        [];
      return {
        context,
        values: values.includes(uuid)
          ? values.filter((value) => value !== uuid)
          : [...values, uuid],
      };
    });
  return {
    ...quote,
    selected,
    toggle,
    active,
    blocked: active && (quote.isFetching || !quote.data || quote.isError),
  };
}
