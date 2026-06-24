export type AuctionStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELED';

export type StreamStatus = 'WAITING' | 'LIVE' | 'ENDED' | 'ERROR';

export type AuctionStream = {
  id: string;
  status: StreamStatus;
  streamUrl?: string | null;
  protocol?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuctionStreamState = {
  auctionId: string;
  room: string;
  canBroadcast: boolean;
  auction: {
    id: string;
    status: AuctionStatus;
    auctionHouseId: string;
  };
  stream: AuctionStream | null;
};

export type Auction = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  scheduledAt?: string | null;
  status: AuctionStatus | string;
  mode: string;
  auctionHouseId?: string;
  auctionHouse?: {
    id: string;
    name: string;
  };
  stream?: AuctionStream | null;
  _count?: {
    lots: number;
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
};
