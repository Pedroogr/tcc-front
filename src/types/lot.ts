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
  // Preco publico anonimo: derivado do lance vencedor pelo backend. Nunca
  // acompanha historico ou identidade de quem lancou (RF06).
  currentPrice?: string | number | null;
  status: string;
  auctionId?: string | null;
  auction?: {
    id: string;
    title: string;
  } | null;
  consignmentId?: string | null;
  media?: LotMedia[];
  createdAt: string;
};

// Retorno seguro de POST /lots/:id/bids: sem autor, so o essencial do lance.
export type Bid = {
  id: string;
  amount: string | number;
  status: string;
  lotId: string;
  createdAt: string;
};

// Lance detalhado, visivel apenas ao escritorio dono via GET /lots/:id/bids.
export type OfficeBid = {
  id: string;
  lotId: string;
  amount: string | number;
  status: string;
  createdAt: string;
  bidder: {
    id: string;
    name: string;
  };
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
  status?: string;
  auctionId: string;
  images?: LotImagePayload[];
};
