interface Snapshot {
  id: string;
  state: string;
  updated_at: string;
}
const terminal = (state: string) => ['completed', 'cancelled', 'needs_review'].includes(state);

/** Late cancel/refresh/SSE responses must not overwrite a newer or final journal snapshot. */
export function mergeOperationSnapshot<T extends Snapshot>(previous: T | null, next: T): T {
  if (
    previous?.id === next.id &&
    (Date.parse(previous.updated_at) > Date.parse(next.updated_at) ||
      (terminal(previous.state) && !terminal(next.state)))
  )
    return previous;
  return next;
}
