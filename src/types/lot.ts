export type Lot = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  breed?: string | null;
  category?: string | null;
  sex?: string | null;
  ageMonths?: number | null;
  weightKg?: number | null;
  quantity: number;
  initialPrice?: string | number | null;
  status: string;
  auctionId?: string | null;
  auction?: {
    id: string;
    title: string;
  } | null;
  createdAt: string;
};

export type CreateLotPayload = {
  code: string;
  title: string;
  description?: string;
  breed?: string;
  category?: string;
  sex?: string;
  ageMonths?: number;
  weightKg?: number;
  quantity?: number;
  initialPrice?: number;
  auctionId: string;
};
