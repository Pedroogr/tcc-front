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
