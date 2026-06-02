export type SellerProfile = {
  id: string;
  userId: string;
  farmName?: string | null;
  ruralRegistration?: string | null;
  stateRegistration?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  document?: string | null;
  platformRole: string;
  status: string;
  buyerProfile?: unknown;
  sellerProfile?: SellerProfile | null;
  createdAt: string;
  updatedAt: string;
};

export type UserAccountType = 'BUYER' | 'SELLER';

export type CreateSellerProfilePayload = {
  farmName?: string;
  ruralRegistration?: string;
  stateRegistration?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  document?: string;
  accountType?: UserAccountType;
  sellerProfile?: CreateSellerProfilePayload;
};

export type AuctionHouse = {
  id: string;
  name: string;
  document?: string | null;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  logoUrl?: string | null;
  status: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};
