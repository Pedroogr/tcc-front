import { apiRequest } from './http';
import type { Bid, CreateLotPayload, Lot, OfficeBid } from '../types/lot';

export function listLots() {
  return apiRequest<Lot[]>('/lots');
}

export function createLot(payload: CreateLotPayload) {
  return apiRequest<Lot>('/lots', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateLot(id: string, payload: Partial<CreateLotPayload>) {
  return apiRequest<Lot>(`/lots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function createBid(lotId: string, amount: number) {
  return apiRequest<Bid>(`/lots/${lotId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

// Historico completo com identidade dos compradores, autorizado apenas ao
// escritorio dono do remate (RF07).
export function listLotBidHistory(lotId: string) {
  return apiRequest<OfficeBid[]>(`/lots/${lotId}/bids`);
}
