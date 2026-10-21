// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { auth, launch } = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isLoading: false },
  launch: { param: 'topup_result_yookassa', telegram: true },
}));
vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (state: typeof auth) => unknown) => selector(auth),
}));
vi.mock('./useTelegramSDK', () => ({
  getTelegramStartParam: () => launch.param,
  isInTelegramWebApp: () => launch.telegram,
}));
import { paymentReturnPath, useMiniAppPaymentReturn } from './useMiniAppPaymentReturn';
function Probe() {
  useMiniAppPaymentReturn();
  const location = useLocation();
  return (
    <output>
      {location.pathname}
      {location.search}
    </output>
  );
}
function App() {
  return (
    <MemoryRouter>
      <Probe />
    </MemoryRouter>
  );
}
beforeEach(() => {
  sessionStorage.clear();
  auth.isAuthenticated = true;
  launch.telegram = true;
});
afterEach(cleanup);
it('открывает результат платежа в авторизованном Mini App', async () => {
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('/balance/top-up/result?method=yookassa'),
  );
});
it('сохраняет возврат до завершения авторизации', async () => {
  auth.isAuthenticated = false;
  const { rerender } = render(<App />);
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('/tg?redirect='));
  expect(sessionStorage.getItem('startapp-redirect:topup_result_yookassa')).toBeNull();
  auth.isAuthenticated = true;
  rerender(<App />);
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('/balance/top-up/result?method=yookassa'),
  );
});
it('не перенаправляет обычный браузер и не принимает произвольные пути', () => {
  launch.telegram = false;
  render(<App />);
  expect(screen.getByRole('status').textContent).toBe('/');
  expect(paymentReturnPath('topup_result_../../admin')).toBeNull();
  expect(paymentReturnPath('gift_example')).toBeNull();
});
