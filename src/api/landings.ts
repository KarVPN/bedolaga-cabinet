import apiClient from './client';

// ============================================================
// Public types
// ============================================================

export interface LandingFeature {
  icon: string;
  title: string;
  description: string;
}

export interface LandingTariffPeriod {
  days: number;
  label: string;
  price_kopeks: number;
  price_label: string;
}

export interface LandingTariff {
  id: number;
  name: string;
  description: string | null;
  traffic_limit_gb: number;
  device_limit: number;
  tier_level: number;
  periods: LandingTariffPeriod[];
}

export interface LandingPaymentMethod {
  method_id: string;
  display_name: string;
  description: string;
  icon_url: string;
  sort_order: number;
}

export interface LandingConfig {
  slug: string;
  title: string;
  subtitle: string | null;
  features: LandingFeature[];
  footer_text: string | null;
  tariffs: LandingTariff[];
  payment_methods: LandingPaymentMethod[];
  gift_enabled: boolean;
  custom_css: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

export interface PurchaseRequest {
  tariff_id: number;
  period_days: number;
  contact_type: 'email' | 'telegram';
  contact_value: string;
  payment_method: string;
  is_gift: boolean;
  gift_recipient_type?: 'email' | 'telegram';
  gift_recipient_value?: string;
  gift_message?: string;
}

export interface PurchaseResponse {
  purchase_token: string;
  payment_url: string;
}

export interface PurchaseStatus {
  status: 'pending' | 'paid' | 'delivered' | 'failed' | 'expired';
  subscription_url: string | null;
  subscription_crypto_link: string | null;
  is_gift: boolean;
  contact_value: string | null;
  period_days: number | null;
  tariff_name: string | null;
}

// ============================================================
// Admin types
// ============================================================

export interface LandingListItem {
  id: number;
  slug: string;
  title: string;
  is_active: boolean;
  display_order: number;
  gift_enabled: boolean;
  tariff_count: number;
  method_count: number;
  purchase_stats: {
    total: number;
    paid: number;
    pending: number;
    failed: number;
  };
  created_at: string | null;
  updated_at: string | null;
}

export interface LandingDetail {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  is_active: boolean;
  features: LandingFeature[];
  footer_text: string | null;
  allowed_tariff_ids: number[];
  allowed_periods: Record<string, number[]>;
  payment_methods: LandingPaymentMethod[];
  gift_enabled: boolean;
  custom_css: string | null;
  meta_title: string | null;
  meta_description: string | null;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface LandingCreateRequest {
  slug: string;
  title: string;
  subtitle?: string;
  is_active?: boolean;
  features?: LandingFeature[];
  footer_text?: string;
  allowed_tariff_ids?: number[];
  allowed_periods?: Record<string, number[]>;
  payment_methods?: LandingPaymentMethod[];
  gift_enabled?: boolean;
  custom_css?: string;
  meta_title?: string;
  meta_description?: string;
}

export type LandingUpdateRequest = Partial<LandingCreateRequest>;

// ============================================================
// Public API
// ============================================================

export const landingApi = {
  getConfig: async (slug: string): Promise<LandingConfig> => {
    const response = await apiClient.get(`/cabinet/landing/${slug}`);
    return response.data;
  },

  createPurchase: async (slug: string, data: PurchaseRequest): Promise<PurchaseResponse> => {
    const response = await apiClient.post(`/cabinet/landing/${slug}/purchase`, data);
    return response.data;
  },

  getPurchaseStatus: async (token: string): Promise<PurchaseStatus> => {
    const response = await apiClient.get(`/cabinet/landing/purchase/${token}`);
    return response.data;
  },
};

// ============================================================
// Admin API
// ============================================================

export const adminLandingsApi = {
  list: async (): Promise<LandingListItem[]> => {
    const response = await apiClient.get('/cabinet/admin/landings');
    return response.data;
  },

  get: async (id: number): Promise<LandingDetail> => {
    const response = await apiClient.get(`/cabinet/admin/landings/${id}`);
    return response.data;
  },

  create: async (data: LandingCreateRequest): Promise<LandingDetail> => {
    const response = await apiClient.post('/cabinet/admin/landings', data);
    return response.data;
  },

  update: async (id: number, data: LandingUpdateRequest): Promise<LandingDetail> => {
    const response = await apiClient.put(`/cabinet/admin/landings/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/cabinet/admin/landings/${id}`);
    return response.data;
  },

  toggle: async (id: number): Promise<{ id: number; is_active: boolean; message: string }> => {
    const response = await apiClient.post(`/cabinet/admin/landings/${id}/toggle`);
    return response.data;
  },

  reorder: async (landingIds: number[]): Promise<void> => {
    await apiClient.put('/cabinet/admin/landings/order', { landing_ids: landingIds });
  },
};
