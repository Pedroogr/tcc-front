import { apiRequest } from './http';
import type { CreateLotPayload, Lot } from '../types/lot';

export function listLots() {
  return apiRequest<Lot[]>('/lots');
}

export function createLot(payload: CreateLotPayload) {
  return apiRequest<Lot>('/lots', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
