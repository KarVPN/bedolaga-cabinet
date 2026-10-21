import { expect, it } from 'vitest';
import { mergeOperationSnapshot } from './bulkOperationState';
const snapshot = (state: string, updated_at = '2026-10-22T00:00:01Z', id = 'operation') => ({
  id,
  state,
  updated_at,
});
it('late cancellation acknowledgement cannot regress a completed run', () => {
  const done = snapshot('cancelled');
  expect(mergeOperationSnapshot(done, snapshot('running'))).toBe(done);
});
it('older SSE or refresh snapshots do not overwrite newer progress', () => {
  const current = snapshot('running');
  expect(mergeOperationSnapshot(current, snapshot('paused', '2026-10-22T00:00:00Z'))).toBe(current);
});
it('accepts a final result and allows selecting another journal operation', () => {
  const done = snapshot('completed');
  expect(mergeOperationSnapshot(snapshot('running'), done)).toBe(done);
  const other = snapshot('paused', '2026-10-21T00:00:00Z', 'other');
  expect(mergeOperationSnapshot(done, other)).toBe(other);
});
