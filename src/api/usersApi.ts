import { apiRequest } from './http';
import type {
  CreateSellerProfilePayload,
  CreateUserPayload,
  User,
} from '../types/user';

export function createUser(payload: CreateUserPayload) {
  return apiRequest<User>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function upsertSellerProfile(payload: CreateSellerProfilePayload) {
  return apiRequest<User>('/users/me/seller-profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
