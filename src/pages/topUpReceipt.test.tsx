// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const openLink = vi.fn();
const createTopUp = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({
    openInvoice: vi.fn(),
    openTelegramLink: vi.fn(),
    openLink,
    platform: 'telegram',
  }),
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn(), selection: vi.fn() }),
}));
vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (v: number) => String(v),
    currencySymbol: '₽',
    convertAmount: (v: number) => v,
    convertToRub: (v: number) => v,
    targetCurrency: 'RUB',
  }),
}));
vi.mock('../api/balance', () => ({
  balanceApi: {
    getPaymentMethods: vi.fn(async () => [
      {
        id: 'yookassa',
        name: 'Cashera',
        description: null,
        min_amount_kopeks: 10000,
        max_amount_kopeks: 10000000,
        is_available: true,
        options: [{ id: 'sbp', name: 'СБП' }],
        quick_amounts: [],
        open_url_direct: true,
      },
    ]),
    createTopUp: (...args: unknown[]) => createTopUp(...args),
  },
}));

import TopUpAmount from './TopUpAmount';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/balance/top-up/yookassa?amount=500']}>
        <Routes>
          <Route path="/balance/top-up/:methodId" element={<TopUpAmount />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submit() {
  const button = await screen.findByRole('button', {
    name: /balance\.topUp|Пополнить|balance\.pay/i,
  });
  fireEvent.click(button);
}

it('запрашивает контакт после ответа YooKassa, сохраняет сумму и возвращается в Mini App', async () => {
  createTopUp
    .mockRejectedValueOnce({
      response: { data: { detail: { code: 'yookassa_receipt_contact_required' } } },
    })
    .mockResolvedValue({ payment_id: '5', payment_url: 'https://pay.example.com/x' });
  renderPage();
  await submit();
  const input = await screen.findByPlaceholderText('balance.receiptContact.placeholder');
  fireEvent.change(input, { target: { value: 'user@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'balance.receiptContact.continue' }));
  await waitFor(() =>
    expect(createTopUp).toHaveBeenLastCalledWith(
      50000,
      'yookassa',
      'sbp',
      true,
      'user@example.com',
      undefined,
    ),
  );
});

it('отклоняет неверный контакт и позволяет передать нормализованный телефон', async () => {
  createTopUp
    .mockRejectedValueOnce({
      response: { data: { detail: { code: 'yookassa_receipt_contact_required' } } },
    })
    .mockResolvedValue({ payment_id: '5', payment_url: 'https://pay.example.com/x' });
  renderPage();
  await submit();
  const input = await screen.findByPlaceholderText('balance.receiptContact.placeholder');
  const next = screen.getByRole('button', { name: 'balance.receiptContact.continue' });
  fireEvent.change(input, { target: { value: 'invalid' } });
  fireEvent.click(next);
  expect(createTopUp).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: '+7 (999) 123-45-67' } });
  fireEvent.click(next);
  await waitFor(() =>
    expect(createTopUp).toHaveBeenLastCalledWith(
      50000,
      'yookassa',
      'sbp',
      true,
      undefined,
      '+79991234567',
    ),
  );
});
