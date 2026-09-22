import type { OfficeBidRecordedPayload } from '../api/socket';
import type { OfficeBid } from '../types/lot';

export function applyOfficeBidEvent(
  current: OfficeBid[],
  payload: OfficeBidRecordedPayload,
): OfficeBid[] {
  const previousBids = current.filter((bid) => bid.id !== payload.bidId);

  return [
    {
      id: payload.bidId,
      lotId: payload.lotId,
      amount: payload.amount,
      status: 'WINNING',
      createdAt: payload.createdAt,
      source: payload.source,
      bidder: payload.bidder,
    },
    ...previousBids.map((bid) =>
      bid.status === 'WINNING' && bid.lotId === payload.lotId
        ? { ...bid, status: 'OUTBID' as const }
        : bid,
    ),
  ];
}

export function reconcileOfficeBidHistory(
  current: OfficeBid[],
  history: OfficeBid[],
  lotId: string,
): OfficeBid[] {
  const currentLotHistory = current.filter((bid) => bid.lotId === lotId);
  const currentNewestAt = Math.max(
    ...currentLotHistory.map((bid) => Date.parse(bid.createdAt)),
  );
  const historyNewestAt = Math.max(
    ...history.map((bid) => Date.parse(bid.createdAt)),
  );

  return currentNewestAt > historyNewestAt ? current : history;
}
