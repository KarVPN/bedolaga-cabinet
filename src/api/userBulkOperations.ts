import apiClient from './client';
import { tokenStorage } from '../utils/token';

export interface BulkFilters {
  search?: string;
  email?: string;
  status?: 'active' | 'blocked' | 'deleted';
  subscription_on_date?: string;
  subscription_status?: 'active' | 'trial' | 'expired' | 'disabled' | 'limited';
  has_subscription?: boolean;
  has_restrictions?: boolean;
  expires_within_days?: number;
}
export type BulkAction = 'add_traffic' | 'extend_subscription' | 'deduct_days';
export interface BulkOperation {
  id: string;
  action: BulkAction;
  params: { traffic_gb: number | null; days: number | null };
  state: 'preview' | 'running' | 'paused' | 'completed' | 'cancelled' | 'needs_review';
  total: number;
  processed: number;
  success: number;
  uncertain: number;
  partial: number;
  skipped: number;
  cancelled: number;
  affected_users: number;
  skipped_users: number;
  subscriptions: number;
  updated_at: string;
  cancel_requested: boolean;
  items: Record<string, number>;
  skip_reasons: { reason: string; count: number }[];
}
export interface BulkPreview {
  request_key: string;
  action: BulkAction;
  traffic_gb?: number;
  days?: number;
  user_ids?: number[];
  filters?: BulkFilters;
  selection_id?: string;
  target_filters?: BulkFilters;
}
export interface BulkError {
  user_id: number;
  subscription_id: number | null;
  state: string;
  message: string;
}
const path = '/cabinet/admin/user-bulk-operations';
export const userBulkApi = {
  list: async (): Promise<BulkOperation[]> => (await apiClient.get(path)).data,
  get: async (id: string): Promise<BulkOperation> => (await apiClient.get(`${path}/${id}`)).data,
  preview: async (input: BulkPreview): Promise<BulkOperation> =>
    (await apiClient.post(`${path}/preview`, input)).data,
  run: async (id: string): Promise<BulkOperation> =>
    (await apiClient.post(`${path}/${id}/run`, {}, { timeout: 0 })).data,
  cancel: async (id: string): Promise<BulkOperation> =>
    (await apiClient.post(`${path}/${id}/cancel`)).data,
  errors: async (id: string, offset = 0): Promise<BulkError[]> =>
    (await apiClient.get(`${path}/${id}/errors`, { params: { offset } })).data,
  watch: async (id: string, signal: AbortSignal, update: (operation: BulkOperation) => void) => {
    // Refresh through the normal client before opening the authenticated SSE stream.
    await userBulkApi.get(id);
    const token = tokenStorage.getAccessToken();
    const response = await fetch(`${apiClient.defaults.baseURL}${path}/${id}/events`, {
      signal,
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok || !response.body) throw new Error('Не удалось открыть поток прогресса');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let end: number;
        while ((end = pending.indexOf('\n\n')) >= 0) {
          const block = pending.slice(0, end);
          pending = pending.slice(end + 2);
          const data = block.split('\n').find((line) => line.startsWith('data: '));
          if (data) update(JSON.parse(data.slice(6)) as BulkOperation);
        }
      }
    } finally {
      await reader.cancel();
    }
  },
};
