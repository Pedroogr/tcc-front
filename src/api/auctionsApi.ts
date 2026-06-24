import { apiRequest } from './http';
import type { Auction, CreateAuctionPayload } from '../types/auction';

export function listAuctions() {
  return apiRequest<Auction[]>('/auctions');
}

export function listPublicAuctions() {
  return apiRequest<Auction[]>('/auctions/public');
}

export function createAuction(payload: CreateAuctionPayload) {
  return apiRequest<Auction>('/auctions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function uploadAuctionThumbnail(auctionId: string, file: File) {
  const formData = new FormData();
  formData.append('thumbnail', file);

  return apiRequest<Auction>(`/auctions/${auctionId}/thumbnail`, {
    method: 'POST',
    body: formData,
  });
}

export function deleteAuctionThumbnail(auctionId: string) {
  return apiRequest<Auction>(`/auctions/${auctionId}/thumbnail`, {
    method: 'DELETE',
  });
}
