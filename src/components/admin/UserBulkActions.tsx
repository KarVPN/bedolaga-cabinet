import { useEffect, useRef, useState } from 'react';
import {
  userBulkApi,
  type BulkAction,
  type BulkError,
  type BulkFilters,
  type BulkOperation,
} from '../../api/userBulkOperations';
import { usePermissionStore } from '../../store/permissions';
import { getApiErrorMessage } from '../../utils/api-error';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../primitives/Dialog';

const button = 'rounded-lg border border-dark-600 px-3 py-2 text-sm disabled:opacity-40';
const finished = (op: BulkOperation) =>
  ['completed', 'cancelled', 'needs_review'].includes(op.state);
const labels: Record<string, string> = {
  preview: 'Предпросмотр',
  running: 'Выполняется',
  paused: 'Прервана — можно продолжить',
  completed: 'Завершена',
  cancelled: 'Оставшиеся отменены',
  needs_review: 'Завершена, есть результаты для проверки',
};
function describe(op: BulkOperation) {
  if (op.action === 'add_traffic') return `Начисление ${op.params.traffic_gb} GB`;
  return `${op.action === 'deduct_days' ? 'Сокращение' : 'Продление'} на ${op.params.days} дн.`;
}
interface Props {
  selected: Set<number>;
  filters: BulkFilters;
  total: number;
  allSelection: BulkOperation | null;
  onSelectAll: (operation: BulkOperation) => void;
  onClear: () => void;
  filterKey: string;
}

export function UserBulkActions({
  selected,
  filters,
  total,
  allSelection,
  onSelectAll,
  onClear,
  filterKey,
}: Props) {
  const allowed = usePermissionStore((state) => state.hasPermission('bulk_actions:execute'));
  const [action, setAction] = useState<BulkAction>('add_traffic');
  const [traffic, setTraffic] = useState(50);
  const [days, setDays] = useState('7');
  const [preview, setPreview] = useState<BulkOperation | null>(null);
  const [operation, setOperation] = useState<BulkOperation | null>(null);
  const [recent, setRecent] = useState<BulkOperation[]>([]);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<BulkError[] | null>(null);
  const [errorOffset, setErrorOffset] = useState(0);
  const [cancelDialog, setCancelDialog] = useState(false);
  const running = useRef(false);
  const preparingRef = useRef(false);
  const mounted = useRef(true);
  const continueBatches = useRef(false);
  const currentFilter = useRef(filterKey);
  currentFilter.current = filterKey;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      continueBatches.current = false;
    };
  }, []);
  useEffect(() => {
    setPreview(null);
  }, [filterKey]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    userBulkApi
      .list()
      .then(async (items) => {
        const history = items.filter((item) => item.state !== 'preview');
        if (!active) return;
        setRecent(history);
        if (history[0]) {
          const current = await userBulkApi.get(history[0].id);
          if (active) setOperation(current);
        }
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, 'Не удалось загрузить журнал операций'));
      });
    return () => {
      active = false;
    };
  }, [allowed]);

  const operationId = operation?.id;
  const terminal = operation ? finished(operation) : false;
  useEffect(() => {
    if (!allowed || !operationId || terminal) return;
    const controller = new AbortController();
    userBulkApi
      .watch(operationId, controller.signal, (next) => {
        if (!controller.signal.aborted)
          setOperation((previous) =>
            previous?.id === next.id &&
            Date.parse(previous.updated_at) > Date.parse(next.updated_at)
              ? previous
              : next,
          );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Поток прогресса прерван. Обновите состояние перед продолжением.');
      });
    return () => controller.abort();
  }, [allowed, operationId, terminal]);

  if (!allowed) return null;
  const selectedCount = allSelection?.total ?? selected.size;
  const validParams =
    action === 'add_traffic' ||
    (Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 3650);

  async function prepare(all = false) {
    if (preparingRef.current || !validParams) return;
    preparingRef.current = true;
    setPreparing(true);
    setError('');
    const requestedFilter = filterKey;
    try {
      const input = {
        request_key: crypto.randomUUID(),
        action,
        ...(action === 'add_traffic' ? { traffic_gb: traffic } : { days: Number(days) }),
        ...(all
          ? { filters }
          : allSelection
            ? { selection_id: allSelection.id }
            : { user_ids: [...selected], target_filters: filters }),
      };
      const next = await userBulkApi.preview(input);
      if (!mounted.current || currentFilter.current !== requestedFilter) return;
      if (all) onSelectAll(next);
      else setPreview(next);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось подготовить действие'));
    } finally {
      preparingRef.current = false;
      if (mounted.current) setPreparing(false);
    }
  }

  async function execute(op: BulkOperation) {
    if (running.current) return;
    running.current = true;
    continueBatches.current = true;
    setBusy(true);
    setError('');
    setPreview(null);
    setOperation(op);
    setErrors(null);
    onClear();
    let current = op;
    try {
      while (mounted.current && continueBatches.current && !finished(current)) {
        const next = await userBulkApi.run(current.id);
        if (mounted.current) setOperation(next);
        // Uncertain outcomes require an explicit operator decision before more work.
        if (
          next.uncertain > current.uncertain ||
          (next.items.uncertain ?? 0) > (current.items.uncertain ?? 0)
        )
          break;
        current = next;
      }
    } catch (err) {
      if (mounted.current) {
        setError(
          getApiErrorMessage(
            err,
            'Запрос прерван. Обновите состояние; не создавайте повторное начисление.',
          ),
        );
        try {
          setOperation(await userBulkApi.get(current.id));
        } catch {
          /* journal survives connection loss */
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function cancel() {
    if (!operation) return;
    continueBatches.current = false;
    setCancelDialog(false);
    try {
      setOperation(await userBulkApi.cancel(operation.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось отменить оставшихся'));
    }
  }
  async function showErrors(offset = 0) {
    if (!operation) return;
    try {
      setErrors(await userBulkApi.errors(operation.id, offset));
      setErrorOffset(offset);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось получить ошибки'));
    }
  }

  return (
    <div className="mb-5 space-y-3">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-error-500/40 p-3 text-sm text-error-400"
        >
          {error}
        </p>
      )}
      {operation && (
        <section
          aria-label="Прогресс массовой операции"
          aria-live="polite"
          className="space-y-3 rounded-xl border border-accent-500/30 bg-dark-800 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{describe(operation)}</strong>
            <span className="text-sm text-dark-300">{labels[operation.state]}</span>
          </div>
          <p>
            Обработано {operation.processed} из {operation.total} пользователей
          </p>
          <progress
            className="h-2 w-full accent-accent-500"
            value={operation.processed}
            max={operation.total || 1}
          />
          <p className="text-sm text-dark-300">
            Успешно: {operation.success} · Частично: {operation.partial} · Требует проверки:{' '}
            {operation.uncertain} · Пропущено: {operation.skipped} · Отменено:{' '}
            {operation.cancelled ?? 0}
          </p>
          <p className="text-xs text-dark-400">
            Подписок: {operation.subscriptions} · Успешных элементов: {operation.items.success ?? 0}{' '}
            · Неопределённых: {operation.items.uncertain ?? 0} · Обновлено:{' '}
            {new Date(operation.updated_at).toLocaleString('ru-RU')}
          </p>
          <div className="flex flex-wrap gap-2">
            {!finished(operation) && (
              <button
                className={button}
                disabled={busy || operation.cancel_requested || !(operation.items.pending ?? 0)}
                onClick={() => execute(operation)}
              >
                Продолжить
              </button>
            )}
            {!finished(operation) && (
              <button
                className={button}
                disabled={operation.cancel_requested}
                onClick={() => setCancelDialog(true)}
              >
                Отменить оставшихся
              </button>
            )}
            <button
              className={button}
              onClick={async () => {
                try {
                  setOperation(await userBulkApi.get(operation.id));
                  setError('');
                } catch (err) {
                  setError(getApiErrorMessage(err, 'Не удалось обновить состояние'));
                }
              }}
            >
              Обновить состояние
            </button>
            <button className={button} onClick={() => showErrors()}>
              Показать ошибки
            </button>
          </div>
          {errors && (
            <div className="space-y-2 text-sm">
              {errors.length === 0 && <p>На этой странице ошибок нет.</p>}
              {errors.map((item) => (
                <p key={`${item.user_id}-${item.subscription_id}`}>
                  Пользователь #{item.user_id}, подписка #{item.subscription_id}: {item.message}
                </p>
              ))}
              <div className="flex gap-2">
                <button
                  className={button}
                  disabled={errorOffset === 0}
                  onClick={() => showErrors(Math.max(0, errorOffset - 50))}
                >
                  Назад
                </button>
                <button
                  className={button}
                  disabled={errors.length < 50}
                  onClick={() => showErrors(errorOffset + 50)}
                >
                  Далее
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      {recent.length > 1 && (
        <label className="block text-sm text-dark-300">
          Последние операции{' '}
          <select
            className="ml-2 rounded-lg bg-dark-800 p-2"
            value={operation?.id ?? ''}
            disabled={busy}
            onChange={async (e) => {
              try {
                setOperation(await userBulkApi.get(e.target.value));
                setErrors(null);
              } catch (err) {
                setError(getApiErrorMessage(err, 'Не удалось загрузить операцию'));
              }
            }}
          >
            {recent.map((item) => (
              <option key={item.id} value={item.id}>
                {describe(item)} · {new Date(item.updated_at).toLocaleString('ru-RU')}
              </option>
            ))}
          </select>
        </label>
      )}
      <section
        aria-label="Массовые действия"
        className="space-y-3 rounded-xl border border-dark-700 bg-dark-800/50 p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Выбрано пользователей: <strong>{selectedCount}</strong>
          </span>
          <button
            className={button}
            disabled={preparing || busy || total === 0}
            onClick={() => prepare(true)}
          >
            Выбрать всех по текущим фильтрам — {total}
          </button>
          {selectedCount > 0 && (
            <button className={button} onClick={onClear}>
              Сбросить выбор
            </button>
          )}
        </div>
        {allSelection && (
          <p className="text-xs text-dark-400">
            Выборка зафиксирована на сервере: {allSelection.total} пользователей. Новые пользователи
            в неё не попадут.
          </p>
        )}
        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Массовое действие"
              className="rounded-lg bg-dark-800 p-2"
              value={action}
              onChange={(e) => setAction(e.target.value as BulkAction)}
            >
              <option value="add_traffic">Добавить трафик</option>
              <option value="extend_subscription">Продлить</option>
              <option value="deduct_days">Сократить срок</option>
            </select>
            {action === 'add_traffic' ? (
              <select
                aria-label="Пакет трафика"
                className="rounded-lg bg-dark-800 p-2"
                value={traffic}
                onChange={(e) => setTraffic(Number(e.target.value))}
              >
                {[10, 50, 100].map((gb) => (
                  <option key={gb} value={gb}>
                    {gb} GB
                  </option>
                ))}
              </select>
            ) : (
              <label className="text-sm">
                Дней{' '}
                <input
                  aria-label="Количество дней"
                  className="w-24 rounded-lg bg-dark-800 p-2"
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </label>
            )}
            <button
              className={button}
              disabled={busy || preparing || !validParams}
              onClick={() => prepare()}
            >
              Предпросмотр и подтверждение
            </button>
          </div>
        )}
      </section>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="pr-8">Подтвердить массовое действие</DialogTitle>
          <DialogDescription>
            Состав целей и параметры зафиксированы. Уже выполненные изменения сохранятся.
          </DialogDescription>
          {preview && (
            <>
              <p className="font-semibold">{describe(preview)}</p>
              <p>
                В выборке: {preview.total} уникальных пользователей, {preview.subscriptions}{' '}
                подписок.
              </p>
              <p>
                Будут затронуты: {preview.affected_users} пользователей,{' '}
                {preview.items.pending ?? 0} подписок. Полностью пропущены: {preview.skipped_users}{' '}
                пользователей.
              </p>
              {preview.skip_reasons.map((skip) => (
                <p className="text-sm text-dark-300" key={skip.reason}>
                  {skip.reason}: {skip.count} элементов.
                </p>
              ))}
              <p className="text-sm text-warning-400">
                {preview.action === 'add_traffic'
                  ? 'Пакет действует 30 дней. Начисление может реактивировать disabled / expired / limited, если срок ещё не истёк. Безлимитные подписки пропускаются.'
                  : preview.action === 'extend_subscription'
                    ? 'Продление считается от текущего окончания, а для истёкших — от текущего времени. Может реактивировать подписку и изменить условия грейса по существующим правилам.'
                    : 'Дни вычитаются из текущей даты окончания. Если новый срок уже прошёл, подписка станет истёкшей; доступ в панели будет отключён.'}
              </p>
              <p className="text-sm">
                Обрабатываются все подходящие подписки каждого пользователя. При ошибке панели
                результат требует проверки; повторного автоматического начисления не будет.
              </p>
              <button
                className={button}
                disabled={busy || !(preview.items.pending ?? 0)}
                onClick={() => execute(preview)}
              >
                Подтвердить и запустить
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogTitle className="pr-8">Отменить оставшихся</DialogTitle>
          <DialogDescription>
            Обработано {operation?.processed ?? 0} из {operation?.total ?? 0} пользователей.
            Осталось незавершённых пользователей:{' '}
            {(operation?.total ?? 0) - (operation?.processed ?? 0)}. Уже выполненные изменения
            сохранятся. Отправленный запрос к панели завершится отдельно.
          </DialogDescription>
          <button className={button} onClick={cancel}>
            Отменить оставшуюся обработку
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
