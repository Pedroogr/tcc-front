import { apiRequest } from './http';
import type {
  CreatedOperatorAccess,
  OperatorAccessSummary,
} from '../types/operator';

export function createOperatorAccess(auctionId: string, label: string) {
  return apiRequest<CreatedOperatorAccess>('/operator/accesses', {
    method: 'POST',
    body: JSON.stringify({ auctionId, label }),
  });
}

export function listOperatorAccesses(auctionId: string) {
  const query = new URLSearchParams({ auctionId });
  return apiRequest<OperatorAccessSummary[]>(
    `/operator/accesses?${query.toString()}`,
  );
}

export function revokeOperatorAccess(accessId: string) {
  return apiRequest<OperatorAccessSummary>(`/operator/accesses/${accessId}`, {
    method: 'DELETE',
  });
}
