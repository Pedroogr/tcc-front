export type OperatorAccessSummary = {
  id: string;
  auctionId: string;
  label: string;
  expiresAt: string;
  usedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type CreatedOperatorAccess = OperatorAccessSummary & {
  code: string;
};

export type OperatorLot = {
  id: string;
  code: string;
  title: string;
  status: 'IN_AUCTION';
  currentPrice: string | null;
  nextMinimumBid: string | null;
};

export type OperatorSession = {
  type: 'OPERATOR';
  operatorAccess: Pick<
    OperatorAccessSummary,
    'id' | 'auctionId' | 'label' | 'expiresAt'
  >;
  currentLot: OperatorLot | null;
};

export type OperatorLoginResponse = {
  accessToken: string;
  actorType: 'OPERATOR';
  operatorAccess: OperatorSession['operatorAccess'];
};

export type OperatorBuyer = {
  id: string;
  name: string;
  documentLast4: string | null;
};

export type CreateOperatorBidPayload = {
  expectedLotId: string;
  buyerId: string;
  amount: number;
};
