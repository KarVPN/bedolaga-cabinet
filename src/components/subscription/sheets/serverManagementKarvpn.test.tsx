// @vitest-environment jsdom
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Subscription } from '../../../types';
const { getCountries, updateCountries } = vi.hoisted(() => ({
  getCountries: vi.fn(),
  updateCountries: vi.fn(async () => ({})),
}));
vi.mock('../../../api/subscription', () => ({
  subscriptionApi: { getCountries, updateCountries },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
import { ServerManagementSheet } from './ServerManagementSheet';
function Harness() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <ServerManagementSheet
      open
      onOpen={() => {}}
      onClose={() => {}}
      subscription={{ id: 42, is_trial: false } as Subscription}
      subscriptionId={42}
      selectedServers={selected}
      onSelectedServersChange={setSelected}
      purchaseOptions={undefined}
      isDark
    />
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('включённый сервер нельзя снять, дополнительный отключается у точной подписки', async () => {
  getCountries.mockResolvedValue({
    countries: [
      {
        uuid: 'included',
        name: 'Included',
        is_available: true,
        is_connected: true,
        is_included_in_tariff: true,
        price_kopeks: 0,
      },
      {
        uuid: 'extra',
        name: 'Extra',
        is_available: true,
        is_connected: true,
        is_included_in_tariff: false,
        price_kopeks: 5000,
      },
    ],
    discount_percent: 0,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );
  const included = await screen.findByRole('button', { name: /Included/ });
  expect((included as HTMLButtonElement).disabled).toBe(true);
  await waitFor(() => expect(getCountries).toHaveBeenCalledWith(42));
  fireEvent.click(screen.getByText('Extra', { exact: true }).closest('button')!);
  fireEvent.click(
    await screen.findByRole('button', { name: 'subscription.serverManagement.applyChanges' }),
  );
  await waitFor(() => expect(updateCountries).toHaveBeenCalledWith(['included'], 42));
});
