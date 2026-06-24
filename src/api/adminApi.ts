import { apiRequest } from './http';

export type OfficeInvite = {
  id: string;
  email: string | null;
  token: string;
  status: string;
  expiresAt: string;
  usedAt: string | null;
  auctionHouse?: { id: string; name: string } | null;
  registrationUrl?: string;
};

export function listOfficeInvites() {
  return apiRequest<OfficeInvite[]>('/admin/office-invites');
}

export function createOfficeInvite(payload: { email?: string; expiresInDays?: number }) {
  return apiRequest<OfficeInvite>('/admin/office-invites', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function revokeOfficeInvite(id: string) {
  return apiRequest<OfficeInvite>(`/admin/office-invites/${id}`, {
    method: 'DELETE',
  });
}
