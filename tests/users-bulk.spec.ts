import { test, expect, type Page } from '@playwright/test';

const operation = (overrides = {}) => ({
  id: 'f9c10506-fbd3-447f-9d79-67feb86880d4',
  action: 'add_traffic',
  params: { traffic_gb: 50, days: null },
  state: 'preview',
  total: 25,
  processed: 1,
  success: 0,
  skipped: 1,
  cancelled: 0,
  partial: 0,
  uncertain: 0,
  affected_users: 24,
  skipped_users: 1,
  subscriptions: 26,
  updated_at: '2026-10-15T09:00:00Z',
  cancel_requested: false,
  items: { pending: 25, skipped: 1 },
  skip_reasons: [{ reason: 'Безлимитный трафик', count: 1 }],
  ...overrides,
});
async function setup(
  page: Page,
  restored = false,
  mode: 'complete' | 'batches' | 'cancel' | 'uncertain' = 'complete',
  previewOverrides: Record<string, unknown> = {},
) {
  page.on('pageerror', (error) => console.error('PAGE ERROR', error));
  const previews: Record<string, unknown>[] = [];
  let runs = 0;
  let current = operation(restored ? { state: 'paused', processed: 12, success: 11 } : {});
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) {
      await route.continue();
      return;
    }
    let data: unknown = {};
    if (path.endsWith('/admin/users')) {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      data = {
        total: 25,
        offset,
        limit: 20,
        users: Array.from({ length: offset ? 5 : 20 }, (_, n) => ({
          id: offset + n + 1,
          telegram_id: 100 + n,
          full_name: `User ${offset + n + 1}`,
          username: `user${offset + n + 1}`,
          first_name: 'User',
          status: 'active',
          has_subscription: true,
          subscription_status: 'active',
          balance_rubles: 0,
          purchase_count: 0,
          estimated_date_subscription_ids: url.searchParams.has('subscription_on_date')
            ? [n + 100]
            : [],
        })),
      };
    } else if (path.endsWith('/user-bulk-operations')) data = restored ? [current] : [];
    else if (path.endsWith('/preview')) {
      previews.push(req.postDataJSON());
      current = operation(previewOverrides);
      data = current;
    } else if (path.endsWith('/cancel')) {
      current = operation({ state: 'running', cancel_requested: true });
      data = current;
    } else if (path.endsWith('/errors')) {
      data = [
        {
          user_id: 7,
          subscription_id: 12,
          state: 'uncertain',
          message: 'Результат требует проверки',
        },
      ];
    } else if (path.endsWith('/run')) {
      runs++;
      current = operation({ state: 'running' });
      await new Promise((resolve) => setTimeout(resolve, mode === 'cancel' ? 1200 : 250));
      current = operation({
        state: 'completed',
        processed: 25,
        success: 24,
        items: { success: 25, skipped: 1 },
      });
      if (mode === 'batches' && runs === 1)
        current = operation({
          state: 'paused',
          processed: 13,
          success: 12,
          items: { pending: 12, success: 13, skipped: 1 },
        });
      if (mode === 'cancel')
        current = operation({
          state: 'cancelled',
          processed: 25,
          success: 1,
          cancelled: 23,
          items: { success: 1, cancelled: 24, skipped: 1 },
        });
      if (mode === 'uncertain')
        current = operation({
          state: 'needs_review',
          processed: 25,
          success: 23,
          uncertain: 1,
          items: { uncertain: 1, success: 24, skipped: 1 },
        });
      data = current;
    } else if (path.endsWith('/events')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `event: progress\ndata: ${JSON.stringify(current)}\n\n`,
      });
      return;
    } else if (path.includes('/user-bulk-operations/')) data = current;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  await page.goto('/tests/fixtures/users.html');
  return { previews, runs: () => runs };
}

test('selection persists across pages, header becomes indeterminate, filters reset selection', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('checkbox', { name: 'Выбрать User 1', exact: true }).check();
  await expect(page.getByText('Выбрано пользователей: 1', { exact: true })).toBeVisible();
  const header = page.getByRole('checkbox', { name: 'Выбрать всех на этой странице' });
  await expect(header).toHaveJSProperty('indeterminate', true);
  await page
    .locator('button')
    .filter({ has: page.locator('svg path[d="M8.25 4.5l7.5 7.5-7.5 7.5"]') })
    .last()
    .click();
  await page.getByRole('checkbox', { name: 'Выбрать User 21', exact: true }).check();
  await expect(page.getByText('Выбрано пользователей: 2', { exact: true })).toBeVisible();
  await page.getByText('Расширенные фильтры', { exact: true }).click();
  await page.getByLabel('Дата подписки').fill('2026-10-10');
  await expect(page.getByText('Выбрано пользователей: 0', { exact: true })).toBeVisible();
  await expect(
    page.getByText('По текущим срокам подходят подписки: #100', { exact: true }),
  ).toBeVisible();
});

test('all results use a server snapshot; confirmation has exact counts and only one run', async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole('button', { name: /Выбрать всех по текущим фильтрам/ }).click();
  await expect(page.getByText(/Выборка зафиксирована на сервере/)).toBeVisible();
  await page.getByLabel('Пакет трафика').selectOption('100');
  await page.getByRole('button', { name: 'Предпросмотр и подтверждение' }).click();
  await expect(page.getByRole('dialog')).toContainText('25 уникальных пользователей, 26 подписок');
  await expect(page.getByRole('dialog')).toContainText('Безлимитный трафик');
  expect(state.previews[1].selection_id).toBe(operation().id);
  expect(state.previews[1].traffic_gb).toBe(100);
  await page
    .getByRole('button', { name: 'Подтвердить и запустить' })
    .evaluate((node: HTMLButtonElement) => {
      node.click();
      node.click();
    });
  await expect(page.getByText('Обработано 25 из 25 пользователей')).toBeVisible();
  expect(state.runs()).toBe(1);
  await page.screenshot({ path: 'test-results/users-bulk-completed.png', fullPage: true });
});

test('restored interrupted operation waits for explicit resume', async ({ page }) => {
  const state = await setup(page, true);
  await expect(page.getByText('Обработано 12 из 25 пользователей')).toBeVisible();
  expect(state.runs()).toBe(0);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByText('Обработано 25 из 25 пользователей')).toBeVisible();
  expect(state.runs()).toBe(1);
});

test('read-only administrator has filters but no bulk controls', async ({ page }) => {
  await setup(page);
  await page.goto('/tests/fixtures/users.html?readonly');
  await expect(page.getByText('Расширенные фильтры', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Выбрать всех по текущим фильтрам/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole('checkbox', { name: 'Выбрать User 1', exact: true })).toHaveCount(0);
});

test('progress aggregates successive batches without another confirmation', async ({ page }) => {
  const state = await setup(page, true, 'batches');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByText('Обработано 25 из 25 пользователей')).toBeVisible();
  expect(state.runs()).toBe(2);
});

test('cancel stops remaining work and explains that applied changes remain', async ({ page }) => {
  const state = await setup(page, true, 'cancel');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('button', { name: 'Отменить оставшихся', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Уже выполненные изменения сохранятся');
  await page.getByRole('button', { name: 'Отменить оставшуюся обработку' }).click();
  await expect(page.getByText('Оставшиеся отменены', { exact: true })).toBeVisible();
  expect(state.runs()).toBe(1);
});

test('uncertain outcomes show review details and are not automatically retried', async ({
  page,
}) => {
  const state = await setup(page, true, 'uncertain');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByText('Завершена, есть результаты для проверки')).toBeVisible();
  await page.getByRole('button', { name: 'Показать ошибки' }).click();
  await expect(
    page.getByText('Пользователь #7, подписка #12: Результат требует проверки'),
  ).toBeVisible();
  expect(state.runs()).toBe(1);
});

test('controls fit the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, true);
  await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/users-bulk-mobile.png', fullPage: true });
});

async function expectDialogInsideViewport(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('opacity', '1');
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box ? Math.abs(box.x + box.width / 2 - viewport.width / 2) : Infinity;
    })
    .toBeLessThanOrEqual(1);
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box ? Math.abs(box.y + box.height / 2 - viewport.height / 2) : Infinity;
    })
    .toBeLessThanOrEqual(1);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(15);
  expect(box.y).toBeGreaterThanOrEqual(15);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 15);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 15);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport();
  return dialog;
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 480 },
  { width: 438, height: 703 },
  { width: 844, height: 390 },
  { width: 1280, height: 1000 },
]) {
  test(`confirmation dialog stays centred and scrolls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const state = await setup(page, false, 'complete', {
      action: 'extend_subscription',
      params: { days: 10, traffic_gb: null },
      total: 99,
      subscriptions: 104,
      affected_users: 65,
      skipped_users: 34,
      items: { pending: 70, skipped: 34 },
      skip_reasons: [
        { reason: 'Нет подходящей подписки', count: 20 },
        { reason: 'Нет закреплённой связи подписки с панелью', count: 14 },
      ],
    });
    await page.getByRole('button', { name: /Выбрать всех по текущим фильтрам/ }).click();
    await page.getByLabel('Массовое действие').selectOption('extend_subscription');
    await page.getByLabel('Количество дней').fill('10');
    await page.getByRole('button', { name: 'Предпросмотр и подтверждение' }).click();
    const dialog = await expectDialogInsideViewport(page);
    await expect(dialog).toContainText('99 уникальных пользователей, 104 подписок');
    const confirm = dialog.getByRole('button', { name: 'Подтвердить и запустить' });
    await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeInViewport();
    if (viewport.height <= 568) {
      expect(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
        true,
      );
    }
    expect(state.runs()).toBe(0);
    // Resizing/rotating an already open Telegram webview must keep it inside.
    await page.setViewportSize({ width: 568, height: 320 });
    await expectDialogInsideViewport(page);
    await page.setViewportSize(viewport);
    await expectDialogInsideViewport(page);
    await dialog.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({ path: testInfo.outputPath('confirmation.png') });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Предпросмотр и подтверждение' }).click();
    await expectDialogInsideViewport(page);
  });

  test(`cancellation dialog stays centred at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await setup(page, true);
    await page.getByRole('button', { name: 'Отменить оставшихся', exact: true }).click();
    const dialog = await expectDialogInsideViewport(page);
    await expect(dialog).toContainText('Уже выполненные изменения сохранятся');
    const confirm = dialog.getByRole('button', { name: 'Отменить оставшуюся обработку' });
    await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}
