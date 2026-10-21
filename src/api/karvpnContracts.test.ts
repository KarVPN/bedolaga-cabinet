import { beforeEach, expect, it, vi } from 'vitest';
const { post } = vi.hoisted(() => ({ post: vi.fn(async () => ({ data: {} })) }));
vi.mock('./client', () => ({ default: { post } }));
vi.mock('../utils/yandexCid', () => ({ getYandexCid: () => '12345678' }));
vi.mock('../i18n', () => ({ default: { language: 'ru' } }));
beforeEach(() => post.mockClear());

it('сохраняет ID подписки и выбранные серверы при продлении и покупке', async () => {
  const { subscriptionApi } = await import('./subscription');
  await subscriptionApi.renewSubscription(30, 42, ['extra']);
  expect(post).toHaveBeenLastCalledWith(
    '/cabinet/subscription/renew',
    { period_days: 30, selected_extra_squads: ['extra'], yandex_cid: '12345678' },
    { params: { subscription_id: 42 } },
  );
  await subscriptionApi.purchaseTariff(7, 30, 100, 42, []);
  expect(post).toHaveBeenLastCalledWith('/cabinet/subscription/purchase-tariff', {
    tariff_id: 7,
    period_days: 30,
    traffic_gb: 100,
    subscription_id: 42,
    selected_extra_squads: [],
    yandex_cid: '12345678',
  });
  await subscriptionApi.previewTariffRenewal(7, 30, 100, ['extra'], 42);
  expect(post).toHaveBeenLastCalledWith('/cabinet/subscription/tariff-renewal-preview', {
    tariff_id: 7,
    period_days: 30,
    traffic_gb: 100,
    selected_extra_squads: ['extra'],
    subscription_id: 42,
  });
});
it('контакт чека и возврат Mini App передаются вместе с языком оригинального API', async () => {
  const { balanceApi } = await import('./balance');
  await balanceApi.createTopUp(50000, 'yookassa', 'sbp', true, 'user@example.com', '+79991234567');
  expect(post).toHaveBeenCalledWith('/cabinet/balance/topup', {
    amount_kopeks: 50000,
    payment_method: 'yookassa',
    payment_option: 'sbp',
    return_to_miniapp: true,
    receipt_email: 'user@example.com',
    receipt_phone: '+79991234567',
    language: 'ru',
  });
});
