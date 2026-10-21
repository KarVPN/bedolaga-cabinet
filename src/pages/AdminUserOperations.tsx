import {
  BackIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
  TelegramIcon,
} from '../components/icons';
import { Link } from 'react-router';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserBulkActions } from '../components/admin/UserBulkActions';
import type { BulkFilters, BulkOperation } from '../api/userBulkOperations';
import { usePermissionStore } from '../store/permissions';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../hooks/useCurrency';
import { adminUsersApi, type UserListItem, type UsersStatsResponse } from '../api/adminUsers';
import { usePlatform } from '../platform/hooks/usePlatform';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colors = {
    blue: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
    green: 'bg-success-500/20 text-success-400 border-success-500/30',
    yellow: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
    red: 'bg-error-500/20 text-error-400 border-error-500/30',
    purple: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
  };

  return (
    <div className={`min-w-0 break-words rounded-xl border p-4 ${colors[color]}`}>
      <div className="mb-1 text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{title}</div>
      {subtitle && <div className="mt-1 text-xs opacity-60">{subtitle}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-success-500/20 text-success-400 border-success-500/30',
    blocked: 'bg-error-500/20 text-error-400 border-error-500/30',
    deleted: 'bg-dark-600 text-dark-400 border-dark-500',
    trial: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
    expired: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
    disabled: 'bg-dark-600 text-dark-400 border-dark-500',
  };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${styles[status] || styles.active}`}>
      {status}
    </span>
  );
}

interface UserRowProps {
  user: UserListItem;
  onClick: () => void;
  formatAmount: (rubAmount: number) => string;
  checked: boolean;
  selectable: boolean;
  onSelect: () => void;
}

function UserRow({ user, onClick, formatAmount, checked, selectable, onSelect }: UserRowProps) {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-dark-700 bg-dark-800/50 p-3 transition-all hover:border-dark-600 hover:bg-dark-800 sm:items-center sm:gap-4 sm:p-4"
    >
      {selectable && (
        <input
          type="checkbox"
          aria-label={`Выбрать ${user.full_name}`}
          checked={checked}
          onClick={(event) => event.stopPropagation()}
          onChange={onSelect}
          className="mt-2 h-4 w-4 shrink-0 accent-accent-500"
        />
      )}
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-accent-700 text-sm font-medium text-white sm:text-base">
        {user.first_name?.[0] || user.username?.[0] || '?'}
      </div>

      {/* Info - flex column on mobile, row on desktop */}
      <div className="min-w-0 flex-1">
        {/* Name and username */}
        <div className="mb-1 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <span className="truncate font-medium text-dark-100">{user.full_name}</span>
          {user.username && (
            <span className="truncate text-xs text-dark-500 sm:text-xs">@{user.username}</span>
          )}
        </div>

        {!!user.estimated_date_subscription_ids?.length && (
          <p className="mb-1 text-xs text-warning-400">
            По текущим срокам подходят подписки:{' '}
            {user.estimated_date_subscription_ids.map((id) => `#${id}`).join(', ')}
          </p>
        )}
        {/* Telegram ID - full width on mobile */}
        <div className="mb-1 flex items-center gap-1 text-xs text-dark-400 sm:mb-0">
          <TelegramIcon />
          <span className="truncate">{user.telegram_id}</span>
        </div>

        {/* Status badges - wrap on mobile */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {user.status !== 'active' && <StatusBadge status={user.status} />}
          {user.has_subscription && user.subscription_status && (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${
                user.subscription_status === 'active'
                  ? 'border-success-500/30 bg-success-500/20 text-success-400'
                  : user.subscription_status === 'trial'
                    ? 'border-accent-500/30 bg-accent-500/20 text-accent-400'
                    : user.subscription_status === 'limited'
                      ? 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
                      : 'border-warning-500/30 bg-warning-500/20 text-warning-400'
              }`}
            >
              {user.subscription_status === 'active'
                ? t('admin.users.status.subscription')
                : user.subscription_status === 'trial'
                  ? t('admin.users.status.trial')
                  : user.subscription_status === 'limited'
                    ? t('subscription.trafficLimited')
                    : t('admin.users.status.expired')}
            </span>
          )}
        </div>
      </div>

      {/* Balance - smaller on mobile, show inline */}
      <div className="shrink-0 text-right">
        <div className="text-sm font-medium text-dark-100 sm:text-base">
          {formatAmount(user.balance_rubles)}
        </div>
        <div className="hidden text-xs text-dark-500 sm:block">
          {user.purchase_count > 0
            ? t('admin.users.purchaseCount', { count: user.purchase_count })
            : t('admin.users.noPurchases')}
        </div>
      </div>

      <ChevronRightIcon />
    </div>
  );
}

export default function AdminUserOperations() {
  const { t } = useTranslation();
  const { formatWithCurrency } = useCurrency();
  const navigate = useNavigate();
  const { capabilities } = usePlatform();

  const canBulk = usePermissionStore((state) => state.hasPermission('bulk_actions:execute'));
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [stats, setStats] = useState<UsersStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const [subscriptionDate, setSubscriptionDate] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [expiresDays, setExpiresDays] = useState('');
  const [hasSubscription, setHasSubscription] = useState('');
  const [restricted, setRestricted] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allSelection, setAllSelection] = useState<BulkOperation | null>(null);
  const pageCheckbox = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);
  const filters = useMemo<BulkFilters>(
    () => ({
      ...(search ? { search } : {}),
      ...(emailSearch ? { email: emailSearch } : {}),
      ...(statusFilter ? { status: statusFilter as BulkFilters['status'] } : {}),
      ...(subscriptionDate ? { subscription_on_date: subscriptionDate } : {}),
      ...(subscriptionStatus
        ? { subscription_status: subscriptionStatus as BulkFilters['subscription_status'] }
        : {}),
      ...(expiresDays ? { expires_within_days: Number(expiresDays) } : {}),
      ...(hasSubscription ? { has_subscription: hasSubscription === 'yes' } : {}),
      ...(restricted ? { has_restrictions: true } : {}),
    }),
    [
      search,
      emailSearch,
      statusFilter,
      subscriptionDate,
      subscriptionStatus,
      expiresDays,
      hasSubscription,
      restricted,
    ],
  );
  const filterKey = JSON.stringify({ ...filters, sort_by: sortBy });
  const clearSelection = () => {
    setSelected(new Set());
    setAllSelection(null);
  };
  useEffect(() => {
    setSelected(new Set());
    setAllSelection(null);
    setOffset(0);
  }, [filterKey]);
  const pageSelected = users.filter((user) => allSelection || selected.has(user.id)).length;
  useEffect(() => {
    if (pageCheckbox.current)
      pageCheckbox.current.indeterminate = pageSelected > 0 && pageSelected < users.length;
  }, [pageSelected, users.length]);

  const limit = 20;

  const loadUsers = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      setLoading(true);
      const params: Record<string, unknown> = { offset, limit, sort_by: sortBy, ...filters };
      if (search) params.search = search;
      if (emailSearch) params.email = emailSearch;
      if (statusFilter) params.status = statusFilter;

      const data = await adminUsersApi.getUsers(
        params as Parameters<typeof adminUsersApi.getUsers>[0],
      );
      if (sequence !== requestSequence.current) return;
      setUsers(data.users);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [offset, search, emailSearch, statusFilter, sortBy, filters]);

  const loadStats = useCallback(async () => {
    try {
      const data = await adminUsersApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    loadUsers();
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="min-w-0 animate-fade-in">
      <Link to="/admin/users" className="mb-4 inline-block text-accent-400">
        К списку пользователей
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600"
            >
              <BackIcon />
            </button>
          )}
          <div className="min-w-0 break-words">
            <h1 className="text-xl font-bold text-dark-100">{t('admin.nav.userOperations')}</h1>
            <p className="text-sm text-dark-400">{t('admin.users.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => {
            loadUsers();
            loadStats();
          }}
          className="shrink-0 rounded-lg p-2 transition-colors hover:bg-dark-700"
        >
          <RefreshIcon className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <UserBulkActions
        selected={selected}
        filters={filters}
        total={total}
        allSelection={allSelection}
        onSelectAll={setAllSelection}
        onClear={clearSelection}
        filterKey={filterKey}
      />

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard title={t('admin.users.stats.total')} value={stats.total_users} color="blue" />
          <StatCard
            title={t('admin.users.stats.active')}
            value={stats.active_users}
            color="green"
          />
          <StatCard
            title={t('admin.users.stats.withSubscription')}
            value={stats.users_with_active_subscription}
            color="purple"
          />
          <StatCard
            title={t('admin.users.stats.newToday')}
            value={stats.new_today}
            color="yellow"
          />
          <StatCard
            title={t('admin.users.stats.blocked')}
            value={stats.blocked_users}
            color="red"
          />
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3">
        {/* Search fields row */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.users.search')}
                className="w-full rounded-xl border border-dark-700 bg-dark-800 py-2 pl-10 pr-4 text-dark-100 placeholder-dark-500 focus:border-dark-600 focus:outline-none"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500">
                <SearchIcon />
              </div>
            </div>
          </form>
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="email"
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                placeholder={t('admin.users.searchEmail')}
                className="w-full rounded-xl border border-dark-700 bg-dark-800 py-2 pl-10 pr-4 text-dark-100 placeholder-dark-500 focus:border-dark-600 focus:outline-none"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500">
                <SearchIcon />
              </div>
            </div>
          </form>
        </div>
        {/* Filters row */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="rounded-xl border border-dark-700 bg-dark-800 px-3 py-2 text-dark-100"
          >
            <option value="">{t('admin.users.filters.allStatuses')}</option>
            <option value="active">{t('admin.users.status.active')}</option>
            <option value="blocked">{t('admin.users.status.blocked')}</option>
            <option value="deleted">{t('admin.users.status.deleted')}</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setOffset(0);
            }}
            className="rounded-xl border border-dark-700 bg-dark-800 px-3 py-2 text-dark-100"
          >
            <option value="created_at">{t('admin.users.filters.byDate')}</option>
            <option value="balance">{t('admin.users.filters.byBalance')}</option>
            <option value="last_activity">{t('admin.users.filters.byActivity')}</option>
            <option value="total_spent">{t('admin.users.filters.bySpent')}</option>
          </select>
        </div>
      </div>

      <details className="mb-4 rounded-xl border border-dark-700 bg-dark-800/50 p-4">
        <summary className="cursor-pointer font-medium">Расширенные фильтры</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Подписка пересекала дату (по текущим срокам)
            <input
              aria-label="Дата подписки"
              type="date"
              value={subscriptionDate}
              onChange={(event) => setSubscriptionDate(event.target.value)}
              className="mt-1 block w-full rounded-lg bg-dark-800 p-2"
            />
          </label>
          <label className="text-sm">
            Статус подписки
            <select
              className="mt-1 block w-full rounded-lg bg-dark-800 p-2"
              value={subscriptionStatus}
              onChange={(event) => setSubscriptionStatus(event.target.value)}
            >
              <option value="">Любой</option>
              <option value="active">Активная</option>
              <option value="trial">Пробная</option>
              <option value="expired">Истекшая</option>
              <option value="disabled">Отключённая</option>
              <option value="limited">Лимит трафика</option>
            </select>
          </label>
          <label className="text-sm">
            Наличие подписки
            <select
              className="mt-1 block w-full rounded-lg bg-dark-800 p-2"
              value={hasSubscription}
              onChange={(event) => setHasSubscription(event.target.value)}
            >
              <option value="">Любое</option>
              <option value="yes">Есть подписка</option>
              <option value="no">Нет подписки</option>
            </select>
          </label>
          <label className="text-sm">
            Истекает в ближайшие дни
            <select
              className="mt-1 block w-full rounded-lg bg-dark-800 p-2"
              value={expiresDays}
              onChange={(event) => setExpiresDays(event.target.value)}
            >
              <option value="">Любой срок</option>
              <option value="7">7 дней</option>
              <option value="14">14 дней</option>
              <option value="30">30 дней</option>
            </select>
          </label>
          <label className="text-sm">
            <input
              className="mr-2 accent-accent-500"
              type="checkbox"
              checked={restricted}
              onChange={(event) => setRestricted(event.target.checked)}
            />
            Есть ограничения
          </label>
        </div>
        <p className="mt-3 text-xs text-warning-400">
          Дата означает пересечение хотя бы части календарного дня в часовой зоне приложения.
          История неполна: фильтр использует текущие start_date / end_date и не подтверждает
          фактическую активность в прошлом. Продления, отмены и восстановление бэкапа могли изменить
          эти даты.
        </p>
        <p className="mt-2 text-xs text-dark-400">
          Изменение фильтров или сортировки сбрасывает выбор пользователей.
        </p>
      </details>
      {canBulk && (
        <label className="mb-3 flex items-center gap-2 text-sm text-dark-300">
          <input
            ref={pageCheckbox}
            type="checkbox"
            checked={users.length > 0 && pageSelected === users.length}
            disabled={loading || users.length === 0}
            onChange={(event) => {
              setAllSelection(null);
              setSelected((previous) => {
                const next = new Set(previous);
                users.forEach((user) => {
                  if (event.target.checked) next.add(user.id);
                  else next.delete(user.id);
                });
                return next;
              });
            }}
            className="h-4 w-4 accent-accent-500"
          />
          Выбрать всех на этой странице
        </label>
      )}
      {/* Users list */}
      <div className="mb-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-dark-400">{t('admin.users.noData')}</div>
        ) : (
          users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              selectable={canBulk}
              checked={!!allSelection || selected.has(user.id)}
              onSelect={() => {
                setAllSelection(null);
                setSelected((previous) => {
                  const next = new Set(previous);
                  if (next.has(user.id)) next.delete(user.id);
                  else next.add(user.id);
                  return next;
                });
              }}
              onClick={() => navigate(`/admin/users/${user.id}`)}
              formatAmount={(amount) => formatWithCurrency(amount)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-dark-400">
            {t('admin.users.pagination.showing', {
              from: offset + 1,
              to: Math.min(offset + limit, total),
              total,
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Предыдущая страница"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="rounded-lg border border-dark-700 bg-dark-800 p-2 transition-colors hover:bg-dark-700 disabled:opacity-50"
            >
              <ChevronLeftIcon />
            </button>
            <span className="px-3 py-2 text-dark-300">
              {currentPage} / {totalPages}
            </span>
            <button
              aria-label="Следующая страница"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="rounded-lg border border-dark-700 bg-dark-800 p-2 transition-colors hover:bg-dark-700 disabled:opacity-50"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
