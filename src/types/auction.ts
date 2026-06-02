export type Auction = {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt?: string | null;
  status: string;
  mode: string;
  auctionHouseId?: string;
  auctionHouse?: {
    id: string;
    name: string;
  };
  lots?: Array<{
    id: string;
    code: string;
    title: string;
    initialPrice?: string | number | null;
    status: string;
  }>;
};

export type CreateAuctionPayload = {
  title: string;
  description?: string;
  scheduledAt?: string;
  status?: string;
  mode?: string;
};
