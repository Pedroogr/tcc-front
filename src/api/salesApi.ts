import { apiRequest } from './http';
import type {
  DeclareWinnerPayload,
  OfficeSale,
  SellerSale,
  WinnerSale,
} from '../types/sale';

export function declareWinner(payload: DeclareWinnerPayload) {
  return apiRequest<OfficeSale>('/sales', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listAuctionHouseSales() {
  return apiRequest<OfficeSale[]>('/sales');
}

export function listMyWins() {
  return apiRequest<WinnerSale[]>('/sales/me');
}

export function listMySales() {
  return apiRequest<SellerSale[]>('/sales/sold');
}
