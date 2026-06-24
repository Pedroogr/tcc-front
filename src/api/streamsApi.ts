import { apiRequest } from './http';
import type { AuctionStreamState } from '../types/auction';

export function getAuctionStream(auctionId: string) {
  return apiRequest<AuctionStreamState>(`/auctions/${auctionId}/stream`);
}

export function startAuctionStream(auctionId: string) {
  return apiRequest<AuctionStreamState>(`/auctions/${auctionId}/stream/start`, {
    method: 'POST',
  });
}

export function stopAuctionStream(auctionId: string) {
  return apiRequest<AuctionStreamState>(`/auctions/${auctionId}/stream/stop`, {
    method: 'POST',
  });
}
