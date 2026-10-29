import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlatformProvider } from '../../src/platform/PlatformProvider';
import { usePermissionStore } from '../../src/store/permissions';
import AdminUsers from '../../src/pages/AdminUserOperations';
import { i18nReady } from '../../src/i18n';
import '../../src/styles/globals.css';

usePermissionStore.setState({
  permissions: location.search.includes('readonly')
    ? ['users:read']
    : [
        'users:read',
        'bulk_actions:execute',
        ...(location.search.includes('no-notify') ? [] : ['users:send_message']),
      ],
  isLoaded: true,
});
// Match the application bootstrap: render only after lazy locale resources load.
await i18nReady;
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <PlatformProvider>
        <main className="mx-auto max-w-5xl p-6">
          <AdminUsers />
        </main>
      </PlatformProvider>
    </MemoryRouter>
  </QueryClientProvider>,
);
