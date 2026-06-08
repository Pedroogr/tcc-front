import { apiRequest } from './http';
import type {
  AuctionHouse,
  BuyerRegistration,
  BuyerRegistrationStatus,
  CreateAuctionHouseInvitePayload,
} from '../types/user';
import type { AuthResponse } from './authApi';

export function listAuctionHouses() {
  return apiRequest<AuctionHouse[]>('/auction-houses');
}

export function validateAuctionHouseInvite(token: string) {
  return apiRequest<{ email?: string | null; expiresAt: string; status: string }>(
    `/auction-houses/invites/${token}`,
  );
}

export function registerAuctionHouseWithInvite(
  token: string,
  payload: CreateAuctionHouseInvitePayload,
) {
  return apiRequest<AuthResponse>(`/auction-houses/invites/${token}/register`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestAuctionHouseApproval(auctionHouseId: string, notes?: string) {
  return apiRequest<BuyerRegistration>(`/auction-houses/${auctionHouseId}/buyer-registrations`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export function listMyBuyerRegistrations() {
  return apiRequest<BuyerRegistration[]>('/auction-houses/me/buyer-registrations');
}

export function reviewBuyerRegistration(
  registrationId: string,
  status: BuyerRegistrationStatus,
  notes?: string,
) {
  return apiRequest<BuyerRegistration>(
    `/auction-houses/me/buyer-registrations/${registrationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    },
  );
}
