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
  media?: LotMedia[];
  createdAt: string;
};

export type LotMedia = {
  id: string;
  type: string;
  url: string;
  description?: string | null;
  sortOrder: number;
};

export type LotImagePayload = {
  fileName: string;
  dataUrl: string;
  description?: string;
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
  images?: LotImagePayload[];
};
