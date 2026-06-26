export type SaleBuyer = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  document?: string | null;
};

export type SaleLot = {
  id: string;
  code: string;
  title: string;
  auction?: {
    id: string;
    title: string;
  } | null;
};

export type SaleAuctionHouse = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type Sale = {
  id: string;
  finalPrice: string | number;
  status: string;
  soldAt: string;
  notes?: string | null;
  lotId: string;
  buyerId: string;
  buyer?: SaleBuyer;
  lot?: SaleLot;
  saleRecordedByAuctionHouse?: SaleAuctionHouse;
  createdAt: string;
};

export type DeclareWinnerPayload = {
  lotId: string;
  notes?: string;
};

export type SaleWonNotification = {
  saleId: string;
  lotId: string;
  lotCode: string;
  lotTitle: string;
  auctionId: string;
  auctionTitle: string;
  finalPrice: string;
};
