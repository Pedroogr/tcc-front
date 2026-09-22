import { apiRequest } from './http';
import type {
  CreateOperatorBidPayload,
  CreatedOperatorAccess,
  OperatorAccessSummary,
  OperatorBuyer,
  OperatorLoginResponse,
  OperatorSession,
} from '../types/operator';
import { apiUrl } from './http';

export const operatorStorage = {
  tokenKey: 'cattleAuctionOperatorToken',
};

export class OperatorApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OperatorApiError';
    this.status = status;
  }
}

async function operatorRequest<T>(
  path: string,
  options: RequestInit = {},
  token = sessionStorage.getItem(operatorStorage.tokenKey),
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { message?: string | string[] };
      message = Array.isArray(parsed.message)
        ? parsed.message.join(' ')
        : (parsed.message ?? body);
    } catch {
      // O backend tambem pode devolver texto puro.
    }
    throw new OperatorApiError(
      message || 'Não foi possível concluir a solicitação.',
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function loginOperator(code: string) {
  return operatorRequest<OperatorLoginResponse>(
    '/operator/login',
    { method: 'POST', body: JSON.stringify({ code }) },
    null,
  );
}

export function getOperatorSession(token?: string) {
  return operatorRequest<OperatorSession>('/operator/session', {}, token);
}

export function searchOperatorBuyers(query: string, token?: string) {
  const params = new URLSearchParams({ query });
  return operatorRequest<OperatorBuyer[]>(
    `/operator/buyers?${params.toString()}`,
    {},
    token,
  );
}

export function createOperatorBid(
  payload: CreateOperatorBidPayload,
  token?: string,
) {
  return operatorRequest<{ id: string; amount?: string; source?: 'ON_SITE' }>(
    '/operator/bids',
    { method: 'POST', body: JSON.stringify(payload) },
    token,
  );
}

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
