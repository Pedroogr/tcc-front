import { apiRequest } from './http';
import type { AuctionHouse, CreateUserPayload, User } from '../types/user';

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthResponse = {
  accessToken: string;
  actorType: 'USER' | 'AUCTION_HOUSE';
  user?: User;
  auctionHouse?: AuctionHouse;
};

export function login(payload: LoginPayload) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function register(payload: CreateUserPayload) {
  return apiRequest<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
