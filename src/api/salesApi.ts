import { apiRequest } from './http';
import type { DeclareWinnerPayload, Sale } from '../types/sale';

export function declareWinner(payload: DeclareWinnerPayload) {
  return apiRequest<Sale>('/sales', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listAuctionHouseSales() {
  return apiRequest<Sale[]>('/sales');
}

export function listMyWins() {
  return apiRequest<Sale[]>('/sales/me');
}
