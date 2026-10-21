// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
const { preview } = vi.hoisted(() => ({ preview: vi.fn() }));
vi.mock('../api/subscription', () => ({ subscriptionApi: { previewTariffRenewal: preview } }));
import { useRenewalExtras } from './useRenewalExtras';
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('считает точную подписку и пересчитывает сумму при исключении сервера', async () => {
  preview.mockImplementation(async (_tariff, _days, _traffic, selected) => ({
    final_total_kopeks: selected?.length === 0 ? 10000 : 15000,
    extra_squads: [{ uuid: 'extra', enabled: selected?.length !== 0 }],
  }));
  const { result, rerender } = renderHook(({ subId }) => useRenewalExtras(7, subId, 30), {
    wrapper,
    initialProps: { subId: 42 },
  });
  expect(result.current.blocked).toBe(true);
  await waitFor(() => expect(result.current.data?.final_total_kopeks).toBe(15000));
  expect(preview).toHaveBeenLastCalledWith(7, 30, undefined, undefined, 42);
  act(() => result.current.toggle('extra'));
  await waitFor(() => expect(result.current.data?.final_total_kopeks).toBe(10000));
  expect(preview).toHaveBeenLastCalledWith(7, 30, undefined, [], 42);
  rerender({ subId: 43 });
  await waitFor(() => expect(preview).toHaveBeenLastCalledWith(7, 30, undefined, undefined, 43));
});
it('блокирует списание при недоступном расчёте', async () => {
  preview.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useRenewalExtras(7, 42, 30), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.blocked).toBe(true);
});
it('не вызывает KarVPN preview при покупке нового тарифа', () => {
  const { result } = renderHook(() => useRenewalExtras(7, undefined, 30, undefined, false), {
    wrapper,
  });
  expect(result.current.blocked).toBe(false);
  expect(preview).not.toHaveBeenCalled();
});
