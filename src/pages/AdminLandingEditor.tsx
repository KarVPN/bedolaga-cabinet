import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminLandingsApi,
  LandingCreateRequest,
  LandingFeature,
  LandingPaymentMethod,
} from '../api/landings';
import { tariffsApi, TariffListItem } from '../api/tariffs';
import { Toggle } from '../components/admin';
import { useNotify } from '@/platform';
import { usePlatform } from '../platform/hooks/usePlatform';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Icons
const BackIcon = () => (
  <svg
    className="h-5 w-5 text-dark-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

const GripIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
    />
  </svg>
);

const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

// ============ Sortable Feature Item ============

interface SortableFeatureProps {
  feature: LandingFeature;
  featureId: string;
  index: number;
  onUpdate: (index: number, field: keyof LandingFeature, value: string) => void;
  onRemove: (index: number) => void;
}

function SortableFeatureItem({
  feature,
  featureId,
  index,
  onUpdate,
  onRemove,
}: SortableFeatureProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: featureId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-lg border p-3 ${
        isDragging ? 'border-accent-500/50 bg-dark-700' : 'border-dark-700 bg-dark-800/50'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-2 flex-shrink-0 cursor-grab touch-none text-dark-500 hover:text-dark-300 active:cursor-grabbing"
      >
        <GripIcon />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={feature.icon}
            onChange={(e) => onUpdate(index, 'icon', e.target.value)}
            placeholder={t('admin.landings.featureIcon')}
            className="w-16 rounded-lg border border-dark-700 bg-dark-800 px-2 py-1.5 text-center text-sm text-dark-100 outline-none focus:border-accent-500"
          />
          <input
            type="text"
            value={feature.title}
            onChange={(e) => onUpdate(index, 'title', e.target.value)}
            placeholder={t('admin.landings.featureTitle')}
            className="min-w-0 flex-1 rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-accent-500"
          />
        </div>
        <input
          type="text"
          value={feature.description}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
          placeholder={t('admin.landings.featureDesc')}
          className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-accent-500"
        />
      </div>
      <button
        onClick={() => onRemove(index)}
        className="mt-2 flex-shrink-0 text-dark-500 hover:text-error-400"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ============ Sortable Payment Method ============

interface SortableMethodProps {
  method: LandingPaymentMethod;
  methodId: string;
  index: number;
  onUpdate: (index: number, field: keyof LandingPaymentMethod, value: string) => void;
  onRemove: (index: number) => void;
}

function SortableMethodItem({ method, methodId, index, onUpdate, onRemove }: SortableMethodProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: methodId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-lg border p-3 ${
        isDragging ? 'border-accent-500/50 bg-dark-700' : 'border-dark-700 bg-dark-800/50'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-2 flex-shrink-0 cursor-grab touch-none text-dark-500 hover:text-dark-300 active:cursor-grabbing"
      >
        <GripIcon />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={method.method_id}
            onChange={(e) => onUpdate(index, 'method_id', e.target.value)}
            placeholder={t('admin.landings.methodId')}
            className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-accent-500"
          />
          <input
            type="text"
            value={method.display_name}
            onChange={(e) => onUpdate(index, 'display_name', e.target.value)}
            placeholder={t('admin.landings.methodName')}
            className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-accent-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={method.description}
            onChange={(e) => onUpdate(index, 'description', e.target.value)}
            placeholder={t('admin.landings.methodDesc')}
            className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-accent-500"
          />
          <input
            type="text"
            value={method.icon_url}
            onChange={(e) => onUpdate(index, 'icon_url', e.target.value)}
            placeholder={t('admin.landings.methodIcon')}
            className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-accent-500"
          />
        </div>
      </div>
      <button
        onClick={() => onRemove(index)}
        className="mt-2 flex-shrink-0 text-dark-500 hover:text-error-400"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ============ Collapsible Section ============

interface SectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, open, onToggle, children }: SectionProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-dark-700 bg-dark-900/50">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-dark-100 hover:bg-dark-800/50"
      >
        {title}
        <ChevronDownIcon open={open} />
      </button>
      {open && <div className="border-t border-dark-700 px-4 py-4">{children}</div>}
    </div>
  );
}

// ============ Main Editor ============

export default function AdminLandingEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { capabilities } = usePlatform();
  const isEdit = !!id;

  // Section visibility
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    features: false,
    tariffs: false,
    methods: false,
    gifts: false,
    footer: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Form state
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [features, setFeatures] = useState<LandingFeature[]>([]);
  const [selectedTariffIds, setSelectedTariffIds] = useState<number[]>([]);
  const [allowedPeriods, setAllowedPeriods] = useState<Record<string, number[]>>({});
  const [paymentMethods, setPaymentMethods] = useState<LandingPaymentMethod[]>([]);
  const [giftEnabled, setGiftEnabled] = useState(false);
  const [footerText, setFooterText] = useState('');
  const [customCss, setCustomCss] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Fetch tariffs for selection
  const { data: tariffsData } = useQuery({
    queryKey: ['admin-tariffs'],
    queryFn: () => tariffsApi.getTariffs(true),
  });

  const allTariffs = tariffsData?.tariffs ?? [];

  // Fetch landing for editing
  const { data: landingData } = useQuery({
    queryKey: ['admin-landing', id],
    queryFn: () => adminLandingsApi.get(Number(id)),
    enabled: isEdit,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Populate form from fetched data (only once)
  const formPopulated = useRef(false);

  // Reset formPopulated when navigating to a different landing
  useEffect(() => {
    formPopulated.current = false;
  }, [id]);

  useEffect(() => {
    if (!landingData || formPopulated.current) return;
    formPopulated.current = true;
    setSlug(landingData.slug);
    setTitle(landingData.title);
    setSubtitle(landingData.subtitle ?? '');
    setIsActive(landingData.is_active);
    setMetaTitle(landingData.meta_title ?? '');
    setMetaDescription(landingData.meta_description ?? '');
    setFeatures(landingData.features ?? []);
    setSelectedTariffIds(landingData.allowed_tariff_ids ?? []);
    setAllowedPeriods(landingData.allowed_periods ?? {});
    setPaymentMethods(landingData.payment_methods ?? []);
    setGiftEnabled(landingData.gift_enabled);
    setFooterText(landingData.footer_text ?? '');
    setCustomCss(landingData.custom_css ?? '');
  }, [landingData]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: adminLandingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-landings'] });
      notify.success(t('admin.landings.created'));
      navigate('/admin/landings');
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      notify.error(message || t('common.error'));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ landingId, data }: { landingId: number; data: LandingCreateRequest }) =>
      adminLandingsApi.update(landingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-landings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-landing', id] });
      notify.success(t('admin.landings.updated'));
      navigate('/admin/landings');
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      notify.error(message || t('common.error'));
    },
  });

  const handleSubmit = () => {
    const data: LandingCreateRequest = {
      slug,
      title,
      subtitle: subtitle || undefined,
      is_active: isActive,
      features,
      footer_text: footerText || undefined,
      allowed_tariff_ids: selectedTariffIds,
      allowed_periods: allowedPeriods,
      payment_methods: paymentMethods,
      gift_enabled: giftEnabled,
      custom_css: customCss || undefined,
      meta_title: metaTitle || undefined,
      meta_description: metaDescription || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ landingId: Number(id), data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ---- Features helpers ----
  const addFeature = () => {
    setFeatures((prev) => [...prev, { icon: '', title: '', description: '' }]);
  };

  const updateFeature = (index: number, field: keyof LandingFeature, value: string) => {
    setFeatures((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  };

  const removeFeature = (index: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFeatureDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFeatures((prev) => {
        const oldIndex = prev.findIndex((_, i) => `feature-${i}` === active.id);
        const newIndex = prev.findIndex((_, i) => `feature-${i}` === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  // ---- Payment methods helpers ----
  const addMethod = () => {
    setPaymentMethods((prev) => [
      ...prev,
      {
        method_id: '',
        display_name: '',
        description: '',
        icon_url: '',
        sort_order: prev.length,
      },
    ]);
  };

  const updateMethod = (index: number, field: keyof LandingPaymentMethod, value: string) => {
    setPaymentMethods((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const removeMethod = (index: number) => {
    setPaymentMethods((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMethodDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPaymentMethods((prev) => {
        const oldIndex = prev.findIndex((_, i) => `method-${i}` === active.id);
        const newIndex = prev.findIndex((_, i) => `method-${i}` === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  // ---- Tariff/period helpers ----
  const toggleTariff = (tariffId: number) => {
    setSelectedTariffIds((prev) =>
      prev.includes(tariffId) ? prev.filter((id) => id !== tariffId) : [...prev, tariffId],
    );
  };

  const togglePeriod = (tariffId: number, days: number) => {
    const key = String(tariffId);
    setAllowedPeriods((prev) => {
      const current = prev[key] ?? [];
      const updated = current.includes(days)
        ? current.filter((d) => d !== days)
        : [...current, days];
      return { ...prev, [key]: updated };
    });
  };

  // Feature IDs for DnD
  const featureIds = features.map((_, i) => `feature-${i}`);
  const methodIds = paymentMethods.map((_, i) => `method-${i}`);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin/landings')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600"
            >
              <BackIcon />
            </button>
          )}
          <h1 className="text-xl font-semibold text-dark-100">
            {isEdit ? t('admin.landings.edit') : t('admin.landings.create')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/landings')}
            className="rounded-lg border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-dark-300 transition-colors hover:border-dark-600"
          >
            {t('admin.landings.back')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !slug || !title}
            className="flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {isPending && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {t('admin.landings.save')}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* General Section */}
        <Section
          title={t('admin.landings.general')}
          open={openSections.general}
          onToggle={() => toggleSection('general')}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-dark-400">{t('admin.landings.slug')}</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={isEdit}
                placeholder="my-landing"
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 outline-none focus:border-accent-500 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-dark-500">{t('admin.landings.slugHint')}</p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.pageTitle')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 outline-none focus:border-accent-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.subtitle')}
              </label>
              <textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 outline-none focus:border-accent-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-dark-400">{t('admin.landings.active')}</label>
              <Toggle checked={isActive} onChange={() => setIsActive(!isActive)} />
            </div>

            {/* SEO */}
            <div className="border-t border-dark-700 pt-4">
              <h4 className="mb-3 text-sm font-medium text-dark-300">{t('admin.landings.seo')}</h4>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-dark-400">
                    {t('admin.landings.metaTitle')}
                  </label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 outline-none focus:border-accent-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-dark-400">
                    {t('admin.landings.metaDesc')}
                  </label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 outline-none focus:border-accent-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Features Section */}
        <Section
          title={t('admin.landings.features')}
          open={openSections.features}
          onToggle={() => toggleSection('features')}
        >
          <div className="space-y-3">
            <DndContext sensors={sensors} onDragEnd={handleFeatureDragEnd}>
              <SortableContext items={featureIds} strategy={verticalListSortingStrategy}>
                {features.map((feature, index) => (
                  <SortableFeatureItem
                    key={featureIds[index]}
                    feature={feature}
                    featureId={featureIds[index]}
                    index={index}
                    onUpdate={updateFeature}
                    onRemove={removeFeature}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              onClick={addFeature}
              className="flex items-center gap-2 rounded-lg border border-dashed border-dark-600 px-4 py-2 text-sm text-dark-400 transition-colors hover:border-dark-500 hover:text-dark-300"
            >
              <PlusIcon />
              {t('admin.landings.addFeature')}
            </button>
          </div>
        </Section>

        {/* Tariffs Section */}
        <Section
          title={t('admin.landings.tariffs')}
          open={openSections.tariffs}
          onToggle={() => toggleSection('tariffs')}
        >
          <div className="space-y-3">
            <p className="text-sm text-dark-500">{t('admin.landings.selectTariffs')}</p>
            {allTariffs.map((tariff: TariffListItem) => (
              <div key={tariff.id} className="rounded-lg border border-dark-700 bg-dark-800/50 p-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedTariffIds.includes(tariff.id)}
                    onChange={() => toggleTariff(tariff.id)}
                    className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-accent-500"
                  />
                  <span className="text-sm font-medium text-dark-100">{tariff.name}</span>
                  {!tariff.is_active && (
                    <span className="rounded bg-dark-600 px-2 py-0.5 text-xs text-dark-400">
                      {t('admin.landings.inactive')}
                    </span>
                  )}
                </label>
                {/* Period checkboxes if tariff is selected and is not daily */}
                {selectedTariffIds.includes(tariff.id) && !tariff.is_daily && (
                  <div className="ml-7 mt-2 flex flex-wrap gap-2">
                    <span className="text-xs text-dark-500">{t('admin.landings.periods')}:</span>
                    {/* We show known periods from the tariff detail. Since TariffListItem doesn't have period_prices,
                        we let the user type periods or rely on the backend returning allowed_periods.
                        For simplicity, show the allowed_periods for this tariff if any are set. */}
                    {(allowedPeriods[String(tariff.id)] ?? []).map((days) => (
                      <button
                        key={days}
                        onClick={() => togglePeriod(tariff.id, days)}
                        className="rounded bg-accent-500/20 px-2 py-0.5 text-xs text-accent-400 hover:bg-accent-500/30"
                      >
                        {days}d<span className="ml-1 text-accent-300">x</span>
                      </button>
                    ))}
                    <AddPeriodButton tariffId={tariff.id} onAdd={togglePeriod} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Payment Methods Section */}
        <Section
          title={t('admin.landings.paymentMethods')}
          open={openSections.methods}
          onToggle={() => toggleSection('methods')}
        >
          <div className="space-y-3">
            <DndContext sensors={sensors} onDragEnd={handleMethodDragEnd}>
              <SortableContext items={methodIds} strategy={verticalListSortingStrategy}>
                {paymentMethods.map((method, index) => (
                  <SortableMethodItem
                    key={methodIds[index]}
                    method={method}
                    methodId={methodIds[index]}
                    index={index}
                    onUpdate={updateMethod}
                    onRemove={removeMethod}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              onClick={addMethod}
              className="flex items-center gap-2 rounded-lg border border-dashed border-dark-600 px-4 py-2 text-sm text-dark-400 transition-colors hover:border-dark-500 hover:text-dark-300"
            >
              <PlusIcon />
              {t('admin.landings.addMethod')}
            </button>
          </div>
        </Section>

        {/* Gift Settings Section */}
        <Section
          title={t('admin.landings.gifts')}
          open={openSections.gifts}
          onToggle={() => toggleSection('gifts')}
        >
          <div className="flex items-center justify-between">
            <label className="text-sm text-dark-400">{t('admin.landings.giftEnabled')}</label>
            <Toggle checked={giftEnabled} onChange={() => setGiftEnabled(!giftEnabled)} />
          </div>
        </Section>

        {/* Footer & Custom CSS Section */}
        <Section
          title={t('admin.landings.content')}
          open={openSections.footer}
          onToggle={() => toggleSection('footer')}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.footerText')}
              </label>
              <textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 outline-none focus:border-accent-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.customCss')}
              </label>
              <textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 font-mono text-sm text-dark-100 outline-none focus:border-accent-500"
              />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ============ Tiny helper for adding a period ============

function AddPeriodButton({
  tariffId,
  onAdd,
}: {
  tariffId: number;
  onAdd: (tariffId: number, days: number) => void;
}) {
  const [value, setValue] = useState('');
  const [showInput, setShowInput] = useState(false);

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="rounded border border-dashed border-dark-600 px-2 py-0.5 text-xs text-dark-500 hover:border-dark-500 hover:text-dark-400"
      >
        +
      </button>
    );
  }

  return (
    <input
      type="number"
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const days = parseInt(value, 10);
        if (days > 0) {
          onAdd(tariffId, days);
        }
        setValue('');
        setShowInput(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const days = parseInt(value, 10);
          if (days > 0) {
            onAdd(tariffId, days);
          }
          setValue('');
          setShowInput(false);
        }
        if (e.key === 'Escape') {
          setValue('');
          setShowInput(false);
        }
      }}
      placeholder="30"
      className="w-16 rounded border border-dark-600 bg-dark-800 px-2 py-0.5 text-xs text-dark-100 outline-none focus:border-accent-500"
    />
  );
}
